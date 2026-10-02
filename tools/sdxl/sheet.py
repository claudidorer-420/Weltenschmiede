# Kontaktbogen zur Sichtung: alle Ergebnisse eines Auftrags (Objekte auf dunklem Grund, Texturen 2×2 gekachelt).
# Aufruf: .venv\Scripts\python.exe sheet.py jobs-stadt.json uebersicht-stadt.png [--cands id]
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
dest = sys.argv[2]
CELL = 300
COLS = 6
font = ImageFont.load_default(size=16) if hasattr(ImageFont, "load_default") else None
rows = (len(jobs) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + 24)), (34, 32, 40))
d = ImageDraw.Draw(sheet)
for i, j in enumerate(jobs):
    kind = j.get("kind", "object")
    p = Path("out") / kind / f"{j['id']}.png"
    x = (i % COLS) * CELL
    y = (i // COLS) * (CELL + 24)
    # Untergrund wie auf der Karte: Steinboden-artig grau-braun
    tile = Image.new("RGB", (CELL - 8, CELL - 8), (88, 84, 76))
    if p.exists():
        im = Image.open(p)
        if kind == "texture":
            t = im.convert("RGB").resize(((CELL - 8) // 2, (CELL - 8) // 2))
            for a in range(2):
                for b in range(2):
                    tile.paste(t, (a * t.width, b * t.height))
        else:
            im = im.convert("RGBA")
            bb = im.getbbox()
            if bb:
                im = im.crop(bb)
            im.thumbnail((CELL - 20, CELL - 20))
            tile.paste(im, ((tile.width - im.width) // 2, (tile.height - im.height) // 2), im)
    sheet.paste(tile, (x + 4, y + 4))
    d.text((x + 6, y + CELL - 2), f"{i + 1}. {j['name']}", fill=(235, 228, 210), font=font)
sheet.save(dest)
print(dest)
