# Monster-Porträts im Hochformat, lokal mit SDXL erzeugt.
#
# Aufruf (aus tools/sdxl):
#   .venv\Scripts\python.exe portraits.py --steps 40 --cands 2
#
# Auftragsliste: portraits.json (aus node tools/build-portrait-jobs.mjs).
# Ergebnisse: out/portrait/<id>.png – Übernahme danach mit import-portraits.py
import argparse
import json
import os
import sys
import time
from pathlib import Path

import torch

# Kurz halten: beide Text-Encoder von SDXL schneiden nach 77 Token ab.
# Reihenfolge = Wichtigkeit: Wesen, Aussehen laut Statblock, Bildausschnitt, Stil.
PROMPT = "portrait of a {en}, {frame}, {art}, {look}, dark stone background, dramatic light, painted fantasy bestiary illustration, highly detailed"
NEG = (
    "text, watermark, signature, frame, border, multiple creatures, collage, photograph, modern clothing, "
    "cartoon, blurry, low quality, deformed, extra limbs, extra heads, cropped head, full body, tiny figure"
)

# Der Typ des Monsters steuert den Stil mit – ein Tier soll nicht wie ein Dämon aussehen
ART = {
    'Tier': 'a real wild animal on all fours',
    'Schwarm': 'a swarm of small animals',
    'Untoter': 'an undead, decayed and eerie',
    'Unhold': 'a fiend of the lower planes',
    'Himmlisches Wesen': 'a radiant celestial',
    'celestisches': 'a radiant celestial',
    'Feenwesen': 'an otherworldly fey',
    'Elementar': 'an elemental of raw matter',
    'Konstrukt': 'a construct of metal or stone',
    'Monstrosität': 'a monstrous beast',
    'Ungeheuer': 'a monstrous beast',
    'Drache': 'a scaled horned dragon',
    'Riese': 'a towering giant',
    'Humanoide': 'a humanoid',
    'Aberration': 'an alien aberration',
    'Pflanze': 'a plant creature of bark and vines',
    'Schlick': 'an amorphous ooze',
    'Schleim': 'an amorphous ooze',
}


def art_of(job):
    if job.get('art'):
        return job['art']
    t = str(job.get('type', ''))
    for k, v in ART.items():
        if t.startswith(k):
            return v
    return 'a fantasy creature'


class Clip:
    """Wählt unter den Kandidaten den, der dem Wesen am ehesten entspricht."""

    def __init__(self):
        self.ok = False
        try:
            from transformers import CLIPModel, CLIPProcessor
            mid = "openai/clip-vit-large-patch14"
            cache = os.environ.get("HF_HOME", "models")
            self.model = CLIPModel.from_pretrained(mid, cache_dir=cache, torch_dtype=torch.float16).to("cuda").eval()
            self.proc = CLIPProcessor.from_pretrained(mid, cache_dir=cache)
            self.ok = True
        except Exception as e:
            print(f"CLIP nicht verfügbar ({e})", flush=True)

    def score(self, img, en, look=""):
        if not self.ok:
            return 0.5
        ziel = f"a fantasy illustration of a {en}" + (f", {look}" if look else "")
        txt = [ziel, "a blurry deformed illustration", "a photo of a modern person"]
        with torch.no_grad():
            inp = self.proc(text=txt, images=img, return_tensors="pt", padding=True).to("cuda")
            inp["pixel_values"] = inp["pixel_values"].half()
            p = torch.softmax(self.model(**inp).logits_per_image[0].float(), 0)
        return float(p[0])


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default="portraits.json")
    ap.add_argument("--out", default="out/portrait")
    ap.add_argument("--steps", type=int, default=40)
    ap.add_argument("--cands", type=int, default=2)
    ap.add_argument("--width", type=int, default=832)
    ap.add_argument("--height", type=int, default=1216)
    ap.add_argument("--only", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--skip-done", action="store_true")
    args = ap.parse_args()

    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    pick = set(x.strip() for x in args.only.split(",") if x.strip())
    if pick:
        jobs = [j for j in jobs if j["id"] in pick]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.skip_done:
        jobs = [j for j in jobs if not (out / f"{j['id']}.png").exists()]
    if args.limit:
        jobs = jobs[: args.limit]

    from diffusers import StableDiffusionXLPipeline, EulerAncestralDiscreteScheduler

    print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'keine'} · {len(jobs)} Porträts", flush=True)
    cache = os.environ.get("HF_HOME", "models")
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16",
        use_safetensors=True, cache_dir=cache,
    )
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)
    try:
        pipe.vae.enable_slicing()
    except Exception:
        pass
    clip = Clip()

    t0 = time.time()
    for n, job in enumerate(jobs, 1):
        prompt = PROMPT.format(en=job["en"], art=art_of(job), look=job.get("look", ""), frame=job.get("frame", "head and shoulders"))
        neg = NEG + ((", " + job["neg"]) if job.get("neg") else "")
        best = None
        bestScore = -1
        for c in range(args.cands):
            seed = abs(hash(job["id"])) % (2 ** 31) + c * 7919
            gen = torch.Generator("cuda").manual_seed(seed)
            img = pipe(
                prompt=prompt, negative_prompt=neg, num_inference_steps=args.steps,
                guidance_scale=6.5, width=args.width, height=args.height, generator=gen,
            ).images[0]
            s = clip.score(img, job["en"], job.get("look", ""))
            if s > bestScore:
                bestScore = s
                best = img
        best.save(out / f"{job['id']}.png")
        per = (time.time() - t0) / n
        print(f"[{n}/{len(jobs)}] {job['name']} → {job['en']} (CLIP {bestScore:.2f}) · {per:.0f}s/Bild", flush=True)
        if n % 25 == 0:
            torch.cuda.empty_cache()
    print(f"fertig in {time.time() - t0:.0f}s → {out.resolve()}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
