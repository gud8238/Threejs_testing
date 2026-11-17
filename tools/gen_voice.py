"""Task 2: generate voice candidates, then lock the picks.

  python3 tools/gen_voice.py candidates          # 3 voices per line -> audio/candidates/
  python3 tools/gen_voice.py pick v1=Gacrux v2=Algenib v3=Gacrux v4=Algenib
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import gemini
from audio_util import AUDIO, ff, normalize_peak

TIGER_VOICES = ["Algenib", "Charon", "Fenrir"]
GRANDMA_VOICES = ["Gacrux", "Sulafat", "Autonoe"]

LINES = {
    "v1": dict(text="으아아아악—!", voices=GRANDMA_VOICES,
               style="terrified elderly Korean grandmother screaming while running out of breath, "
                     "comically exaggerated, high pitched, short"),
    "v2": dict(text="어흥~ 떡 하나 주면… <short pause> 안 잡아먹지이~!", voices=TIGER_VOICES,
               style="big sly tiger in a Korean folk tale, deep booming growly voice, playful and menacing, "
                     "'어흥' growled, teasing sing-song on the last word, fast"),
    "v3": dict(text="아이고오오—!", voices=GRANDMA_VOICES,
               style="elderly Korean grandmother looking back in panic, shrill desperate wail, "
                     "higher and more urgent, comically exaggerated, short"),
    "v4": dict(text="크아아앙!", voices=TIGER_VOICES,
               style="tiger pouncing with a huge ferocious roar, explosive, guttural, very short"),
}

CAND = AUDIO / "candidates"


def trim(src: Path, dst: Path):
    """Strip leading/trailing silence, pad 30 ms, peak -1.5 dBTP, 48 kHz."""
    with tempfile.TemporaryDirectory() as d:
        t = Path(d) / "t.wav"
        ff("-i", src, "-af",
           "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
           "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
           "adelay=30,apad=pad_dur=0.03", t)
        normalize_peak(t, dst, -1.5)


def candidates():
    CAND.mkdir(parents=True, exist_ok=True)
    for vid, line in LINES.items():
        for voice in line["voices"]:
            raw = CAND / f"{vid}_{voice}.raw.wav"
            raw.write_bytes(gemini.tts(line["text"], voice, line["style"]))
            trim(raw, CAND / f"{vid}_{voice}.wav")
            raw.unlink()
            print("ok", vid, voice)


def pick(args):
    for a in args:
        vid, voice = a.split("=")
        subprocess.run(["cp", str(CAND / f"{vid}_{voice}.wav"), str(AUDIO / f"{vid}.wav")], check=True)
        print("picked", vid, voice)


if __name__ == "__main__":
    candidates() if sys.argv[1] == "candidates" else pick(sys.argv[2:])
