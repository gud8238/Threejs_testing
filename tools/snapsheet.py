"""Snapshot several times and tile them into one contact sheet.
Usage: python3 tools/snapsheet.py out.jpg 0 1.5 3 ... [--vars JSON] [--w 640]"""
import os, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent
ENV = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1",
           HYPERFRAMES_BROWSER_PATH="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
args = sys.argv[1:]
out = args.pop(0)
w = 640
if "--w" in args:
    i = args.index("--w"); w = int(args[i + 1]); del args[i:i + 2]
times = args
d = Path(tempfile.mkdtemp())
subprocess.run(["npx", "hyperframes", "snapshot", str(ROOT / "a-25d"), "--at", ",".join(times), "--no-end",
                "-o", str(d), "--timeout", "170000", "--no-browser-gpu"], env=ENV, check=True, capture_output=True)
pngs = sorted(d.glob("*.png"))
cols = 2 if len(pngs) > 1 else 1
h = w * 9 // 16
rows = (len(pngs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (0, 0, 0))
for k, (p, t) in enumerate(zip(pngs, times)):
    im = Image.open(p).convert("RGB").resize((w, h))
    ImageDraw.Draw(im).text((8, 6), f"{t}s", fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * w, (k // cols) * h))
sheet.save(out, quality=85)
print(out, [p.name for p in pngs])
