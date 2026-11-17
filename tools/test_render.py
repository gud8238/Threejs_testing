"""Render-level checks via `hyperframes snapshot` (SwiftShader, deterministic)."""
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT / os.environ.get("HF_PROJECT", "a-25d")  # HF_PROJECT=b2-3d runs the same checks on B2
ENV = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1",
           HYPERFRAMES_BROWSER_PATH="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
_cache = {}


def snap(times, variables=None) -> list[np.ndarray]:
    """Snapshot each time in its own run order; returns RGB arrays in the given order."""
    key = (tuple(times), str(variables))
    if key in _cache:
        return _cache[key]
    out = Path(tempfile.mkdtemp())
    imgs = []
    for i, t in enumerate(times):
        d = out / str(i)
        cmd = ["npx", "hyperframes", "snapshot", str(PROJECT), "--at", str(t), "--no-end",
               "-o", str(d), "--timeout", "170000", "--no-browser-gpu"]
        if variables:
            cmd += ["--variables", variables]
        subprocess.run(cmd, cwd=ROOT, env=ENV, check=True, capture_output=True)
        png = sorted(d.glob("*.png"))[0]
        imgs.append(np.asarray(Image.open(png).convert("RGB")).astype(np.int16))
    _cache[key] = imgs
    return imgs


def test_same_time_is_pixel_identical():
    a, _, b = snap([4, 0, 4])
    assert np.array_equal(a, b), f"max diff {np.abs(a - b).max()}"


def test_frame_is_a_rendered_scene():
    a, _, _ = snap([4, 0, 4])
    assert a.shape[:2] == (720, 1280)
    assert a.std() > 30, f"frame looks flat (std {a.std():.1f})"


def test_camera_moves_over_time():
    a, z, _ = snap([4, 0, 4])
    assert np.abs(a - z).mean() > 8, "0s and 4s frames are nearly the same"


def test_freeze_holds_still():
    """After the freeze nothing moves: with grain off, 9.4 s and 9.6 s are identical."""
    a, b = snap([9.4, 9.6])
    assert np.array_equal(a, b), f"mean diff {np.abs(a - b).mean():.3f}"


def test_freeze_is_desaturated():
    a, = snap([9.5])
    rgb = a.astype(float)
    sat = (rgb.max(axis=2) - rgb.min(axis=2)).mean()
    b, = snap([8.6])
    sat_before = (b.max(axis=2) - b.min(axis=2)).astype(float).mean()
    assert sat < sat_before * 0.6, f"{sat:.1f} vs {sat_before:.1f}"


def test_ends_in_black():
    a, = snap([9.95])
    assert a.mean() < 0.05 * 255, f"mean {a.mean():.1f}"
