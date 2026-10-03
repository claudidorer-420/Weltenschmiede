# Übernimmt die erzeugten Monsterporträts in die App:
#   assets/portraits/<id>.webp        Hochformat (max. 768 px hoch) für Bestiarium und NSC-Bogen
#   assets/portraits/q/<id>.webp      quadratischer Ausschnitt (Kopfbereich) für Token und Initiativleiste
#   js/data/portraits.js              Liste der vorhandenen Bilder (damit die App nicht raten muss)
#
# Aufruf (aus tools/sdxl):  .venv\Scripts\python.exe import-portraits.py [--jobs x.json] [--only id1,id2] [--force]
#                           [--src <auftragsordner>/fertig]   (liest dort portrait/<id>.png, sonst out/portrait)
import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "out" / "portrait"
ZIEL = ROOT / "assets" / "portraits"
HOCH = 768          # Höhe des Hochformats
QUAD = 320          # Kantenlänge des quadratischen Ausschnitts
KOPF = 0.06         # so weit unterhalb der Oberkante beginnt der Ausschnitt


def save_webp(img: Image.Image, path: Path, quality: int = 84):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=5)


def quadrat(img: Image.Image, mitte: bool = False) -> Image.Image:
    """Kopf und Schultern aus dem Hochformat schneiden – bei ganz gemalten Gestalten (Schlangen, Elementare, Schleime …)
    den mittleren Ausschnitt, dort steht das Wesen nicht oben im Bild."""
    w, h = img.size
    seite = min(w, h)
    oben = (h - seite) // 2 if mitte else int(min(max(0, h * KOPF), h - seite))
    links = (w - seite) // 2
    return img.crop((links, oben, links + seite, oben + seite)).resize((QUAD, QUAD), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default="portraits.json")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--src", default="", help="Auftragsordner …/fertig (darin portrait/<id>.png)")
    args = ap.parse_args()
    quelle = (Path(args.src) / "portrait") if args.src else OUT
    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    pick = {x.strip() for x in args.only.split(",") if x.strip()}

    fertig = []
    for job in jobs:
        jid = job["id"]
        if pick and jid not in pick:
            continue
        src = quelle / f"{jid}.png"
        if not src.exists():
            continue
        ziel = ZIEL / f"{jid}.webp"
        if ziel.exists() and not args.force:
            fertig.append(jid)
            continue
        img = Image.open(src).convert("RGB")
        k = HOCH / img.height
        hoch = img.resize((max(1, round(img.width * k)), HOCH), Image.LANCZOS)
        save_webp(hoch, ziel, 84)
        save_webp(quadrat(img, "whole" in str(job.get("rahmen", ""))), ZIEL / "q" / f"{jid}.webp", 82)
        fertig.append(jid)
        print(f"Porträt: {job.get('name', jid)}")

    # Vorhandene Bilder erfassen (auch die aus früheren Läufen)
    alle = sorted(p.stem for p in ZIEL.glob("*.webp"))
    # Fingerabdruck je Porträt: Der Service Worker hält Bilder unter /assets/ dauerhaft im Cache – die App hängt ?v= an,
    # damit ein ausgetauschtes Porträt (gleicher Dateiname) bei allen Geräten ankommt
    def fingerabdruck(jid):
        h = hashlib.md5()
        for p in (ZIEL / f"{jid}.webp", ZIEL / "q" / f"{jid}.webp"):
            if p.exists():
                h.update(p.read_bytes())
        return h.hexdigest()[:8]
    versionen = {jid: fingerabdruck(jid) for jid in alle}
    kopf = (
        "// Erzeugt von tools/sdxl/import-portraits.py – nicht von Hand ändern.\n"
        "// Monsterporträts im Hochformat (assets/portraits/<id>.webp) plus quadratischer\n"
        "// Ausschnitt für Token und Initiativleiste (assets/portraits/q/<id>.webp).\n"
        "// Lokal erzeugt (FLUX.2 klein 4B bzw. früher SDXL 1.0); die Bilder gehören zur Weltenschmiede.\n"
        "// PORTRAIT_V = Fingerabdruck des Bildinhalts (Adresse bekommt ?v=, siehe ui/art.js).\n"
    )
    js = (
        kopf
        + "export const PORTRAITS = new Set(" + json.dumps(alle, ensure_ascii=False) + ");\n"
        + "export const PORTRAIT_V = " + json.dumps(versionen, ensure_ascii=False) + ";\n"
    )
    (ROOT / "js" / "data" / "portraits.js").write_text(js, encoding="utf-8")
    print(f"\n{len(fertig)} Porträts übernommen, {len(alle)} insgesamt in assets/portraits.")


if __name__ == "__main__":
    main()
