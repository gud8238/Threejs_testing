"""Task 2: generate the BGM with Lyria (spec §4 prompt).

  python3 tools/gen_bgm.py [take_name]     # -> audio/candidates/bgm_<take>.wav
  python3 tools/gen_bgm.py pick <take_name>
"""
import shutil
import sys

import gemini
from audio_util import AUDIO, normalize_peak

PROMPT = (
    "Instrumental only, no vocals. A tense but comic chase cue for an animated short: "
    "Korean traditional percussion (janggu and buk drums) driving a fast 140 bpm pulse, "
    "a daegeum flute melody, staccato orchestral strings and pizzicato. "
    "Starts already energetic (no slow intro), builds steadily for about 30 seconds, "
    "then ends abruptly on one big hit."
)


def generate(take: str):
    out = AUDIO / "candidates"
    out.mkdir(parents=True, exist_ok=True)
    raw = out / f"bgm_{take}.raw.wav"
    raw.write_bytes(gemini.music(PROMPT))
    normalize_peak(raw, out / f"bgm_{take}.wav", -1.5)
    raw.unlink()
    print("ok bgm", take)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "pick":
        shutil.copy(AUDIO / "candidates" / f"bgm_{sys.argv[2]}.wav", AUDIO / "bgm.wav")
    else:
        generate(sys.argv[1] if len(sys.argv) > 1 else "a")
