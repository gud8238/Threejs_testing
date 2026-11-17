"""Task 2 audio checks."""
import pytest

from audio_util import AUDIO, duration, loudness

SFX = ["wind", "whoosh1", "whoosh2", "impact1", "impact2", "riser", "step"]
VOICES = {"v1": (0.8, 1.6), "v2": (1.8, 3.0), "v3": (0.6, 1.4), "v4": (0.5, 1.2)}


def test_sfx_exist_and_peak():
    for s in SFX:
        p = AUDIO / "sfx" / f"{s}.wav"
        assert p.exists(), s
        assert loudness(p)["tp"] <= -1.0, s
    assert duration(AUDIO / "sfx/wind.wav") >= 11.0
    assert duration(AUDIO / "sfx/step.wav") <= 0.3


@pytest.mark.parametrize("vid", sorted(VOICES))
def test_voice_length_and_peak(vid):
    p = AUDIO / f"{vid}.wav"
    lo, hi = VOICES[vid]
    assert lo <= duration(p) <= hi, f"{vid} {duration(p):.2f}s"
    assert loudness(p)["tp"] <= -1.0


def test_bgm():
    p = AUDIO / "bgm.wav"
    assert duration(p) >= 12.0
    assert loudness(p)["tp"] <= -1.0
