#!/usr/bin/env python3
"""Tile the wrap-up captures into one contact sheet per folder.

Crops each screenshot to the card region so a reviewer compares cards rather
than status bars and share buttons, and labels every tile with its case id.
"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/wu/cases")
COLS, PAD, LABEL_H, BG = 4, 16, 34, (24, 24, 24)

# The card occupies a stable band of the screen; below it are the share
# buttons, which are identical on every case and waste the grid.
TOP_FRAC, BOT_FRAC = 0.115, 0.475

def font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            continue
    return ImageFont.load_default()

F = font(24)

for group in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    shots = sorted(group.glob("*.png"))
    if not shots:
        continue

    tiles = []
    for s in shots:
        im = Image.open(s).convert("RGB")
        w, h = im.size
        im = im.crop((0, int(h * TOP_FRAC), w, int(h * BOT_FRAC)))
        im.thumbnail((520, 10_000), Image.LANCZOS)
        tiles.append((s.stem, im))

    tw = max(t.width for _, t in tiles)
    th = max(t.height for _, t in tiles)
    rows = (len(tiles) + COLS - 1) // COLS
    cols = min(COLS, len(tiles))

    sheet = Image.new("RGB",
                      (cols * (tw + PAD) + PAD,
                       rows * (th + LABEL_H + PAD) + PAD), BG)
    d = ImageDraw.Draw(sheet)

    for i, (name, im) in enumerate(tiles):
        r, c = divmod(i, COLS)
        x = PAD + c * (tw + PAD)
        y = PAD + r * (th + LABEL_H + PAD)
        sheet.paste(im, (x + (tw - im.width) // 2, y))
        d.text((x, y + th + 6), name, fill=(235, 235, 235), font=F)

    out = ROOT / f"_{group.name}.png"
    sheet.save(out)
    print(f"{out}  ({len(tiles)} cases)")
