"""Task 2: build sound effects (bundled HyperFrames SFX trimmed + synthesized wind).

Usage: python3 tools/gen_sfx.py
"""
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from audio_util import AUDIO, ROOT, ff, normalize_peak

LIB = ROOT / "node_modules/hyperframes/dist/skills/media-use/audio/assets/sfx"
OUT = AUDIO / "sfx"


def peak_time(path) -> float:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000",
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.abs(np.frombuffer(raw, np.float32))
    env = np.convolve(x, np.ones(400) / 400, "same")
    return float(np.argmax(env) / 8000)


def make(name, args):
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d) / "a.wav"
        ff(*args, "-ac", 2, "-ar", 48000, tmp)
        normalize_peak(tmp, OUT / f"{name}.wav", -1.5)
    print("sfx", name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # mountain wind: brown noise, band-limited, slow gusts (seeded, deterministic)
    make("wind", ["-f", "lavfi", "-i", "anoisesrc=color=brown:seed=7:duration=11.5:amplitude=0.6",
                  "-af", "highpass=f=80,lowpass=f=1400,"
                  "volume='0.55+0.45*sin(2*PI*0.23*t)*sin(2*PI*0.07*t+1)':eval=frame,"
                  "afade=t=in:d=0.4,afade=t=out:st=11.0:d=0.5"])
    make("whoosh1", ["-i", LIB / "whoosh.mp3"])
    pc = peak_time(LIB / "whoosh-cinematic.mp3")
    st = max(0.0, pc - 0.9)
    make("whoosh2", ["-ss", f"{st:.3f}", "-t", "1.6", "-i", LIB / "whoosh-cinematic.mp3",
                     "-af", "afade=t=in:d=0.05,afade=t=out:st=1.3:d=0.3"])
    make("impact1", ["-i", LIB / "impact-bass-1.mp3"])
    make("impact2", ["-i", LIB / "impact-bass-2.mp3"])
    pr = peak_time(LIB / "riser.mp3")
    make("riser", ["-ss", f"{max(0.0, pr - 1.4):.3f}", "-t", "1.5", "-i", LIB / "riser.mp3",
                   "-af", "afade=t=in:d=0.3,afade=t=out:st=1.4:d=0.1"])
    make("step", ["-t", "0.18", "-i", LIB / "impact-bass-1.mp3",
                  "-af", "lowpass=f=400,afade=t=out:st=0.08:d=0.1"])


if __name__ == "__main__":
    main()
