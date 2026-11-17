"""Task 1 asset checks: cutouts are clean single pieces, background layers exist."""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / "a-25d/assets/chars"
BG = ROOT / "a-25d/assets/bg"
IDS = ["g_2", "g_3", "g_4", "g_5", "t_2", "t_3", "t_4", "t_5", "t_6"]


def _alpha(i):
    return np.array(Image.open(CHARS / f"{i}.png").convert("RGBA"))


def test_chars_single_component():
    for i in IDS:
        a = _alpha(i)[..., 3] > 20
        lab, n = ndimage.label(a)
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        stray = [s for s in sizes if s < sizes.max() * 0.05]
        assert not stray, f"{i}: {len(stray)} stray fragments"
        assert a.shape[0] >= 400, f"{i}: height {a.shape[0]} < 400"


def test_chars_no_halo():
    for i in IDS:
        rgba = _alpha(i).astype(float)
        a = rgba[..., 3] > 127
        inner = ndimage.binary_erosion(a, iterations=6)
        band = a & ~ndimage.binary_erosion(a, iterations=2)
        lum = rgba[..., :3].mean(axis=2)
        # compare each edge pixel with the nearest interior pixel (local halo, not global mean)
        _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
        diff = np.abs(lum[band] - lum[iy[band], ix[band]]).mean()
        assert diff < 25, f"{i}: mean edge-vs-interior luminance diff {diff:.1f}"


def test_meta():
    meta = json.loads((CHARS / "meta.json").read_text())
    assert sorted(meta) == sorted(IDS)
    for i, m in meta.items():
        assert 0.9 <= m["footY"] <= 1.0, i
        assert m["w"] > 0 and m["h"] >= 400, i


def test_bg():
    color = Image.open(BG / "color.png")
    depth = Image.open(BG / "depth.png")
    occ = np.array(Image.open(BG / "occluder.png").convert("RGBA"))
    assert color.size == (3344, 1882)
    assert depth.size == (3344, 1882) and depth.mode in ("I;16", "I")
    ratio = (occ[..., 3] > 20).mean()
    assert 0.05 <= ratio <= 0.30, f"occluder ratio {ratio:.3f}"
