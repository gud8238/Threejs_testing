"""Small ffmpeg helpers shared by audio scripts and tests."""
import re
import subprocess
from pathlib import Path


def duration(path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def loudness(path) -> dict:
    """Integrated loudness (LUFS) and true peak (dBTP) via ffmpeg ebur128."""
    err = subprocess.run(
        ["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    f = lambda m: float("-inf") if m.group(1) == "-inf" else float(m.group(1))
    return {"lufs": f(i), "tp": f(tp)}


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, args)], check=True)


def normalize_peak(src, dst, target_tp=-1.5):
    """Scale so true peak sits at target_tp (dBTP), 48 kHz output."""
    tp = loudness(src)["tp"]
    gain = target_tp - tp
    ff("-i", src, "-af", f"volume={gain:.2f}dB", "-ar", 48000, dst)


ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "a-25d/assets/audio"
