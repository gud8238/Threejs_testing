"""Task 1: cut out pose sheets and build background color/depth/occluder layers.

Usage: python3 tools/prep_assets.py
"""
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets_src"
CHARS = ROOT / "a-25d/assets/chars"
BG = ROOT / "a-25d/assets/bg"
DEPTH_MODEL = Path.home() / ".cache/depth/vits.onnx"

# pose sheet cell index (1..6, row-major 3x2) -> output id
POSES = {
    "grandma_poses.png": {2: "g_2", 3: "g_3", 4: "g_4", 5: "g_5"},
    "tiger_poses.png": {2: "t_2", 3: "t_3", 4: "t_4", 5: "t_5", 6: "t_6"},
}


def keep_largest(rgba: np.ndarray, dilate: int = 2) -> np.ndarray:
    a = rgba[..., 3] > 20
    lab, n = ndimage.label(a)
    if n > 1:
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        keep = lab == (np.argmax(sizes) + 1)
        if dilate:
            keep = ndimage.binary_dilation(keep, iterations=dilate)
        rgba[..., 3] = rgba[..., 3] * keep
    return rgba


def defringe(rgba: np.ndarray) -> np.ndarray:
    """Shrink alpha by 1px and pull edge colors from the solid interior."""
    alpha = rgba[..., 3].astype(np.float32)
    solid = ndimage.binary_erosion(alpha > 250, iterations=3)
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    edge = (alpha > 0) & ~solid
    rgb = rgba[..., :3].copy()
    rgb[edge] = rgba[..., :3][iy[edge], ix[edge]]
    alpha = ndimage.grey_erosion(alpha, size=(3, 3))
    out = np.dstack([rgb, alpha.astype(np.uint8)])
    return out


def cut_poses(session) -> dict:
    meta = {}
    CHARS.mkdir(parents=True, exist_ok=True)
    for sheet, cells in POSES.items():
        im = Image.open(SRC / sheet).convert("RGB")
        W, H = im.size
        for idx, name in cells.items():
            r, c = divmod(idx - 1, 3)
            cell = im.crop((c * W // 3, r * H // 2, (c + 1) * W // 3, (r + 1) * H // 2))
            cell = cell.resize((cell.width * 2, cell.height * 2), Image.LANCZOS)
            cut = remove(cell, session=session, alpha_matting=True,
                         alpha_matting_foreground_threshold=240,
                         alpha_matting_background_threshold=15,
                         alpha_matting_erode_size=8)
            rgba = keep_largest(defringe(keep_largest(np.array(cut.convert("RGBA")))), dilate=0)
            out = Image.fromarray(rgba)
            out = out.crop(out.getbbox())
            out.save(CHARS / f"{name}.png", optimize=True)
            meta[name] = {"w": out.width, "h": out.height, "footY": 1.0}
            print("cut", name, out.size)
    (CHARS / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def build_background():
    BG.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC / "background.png").convert("RGB")
    color = src.resize((src.width * 2, src.height * 2), Image.LANCZOS)
    color.save(BG / "color.png", optimize=True)

    sess = ort.InferenceSession(str(DEPTH_MODEL))
    x = np.asarray(src.resize((518, 518), Image.BICUBIC), np.float32) / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    d = (d - d.min()) / (d.max() - d.min())  # 1 = near
    df = Image.fromarray(d.astype(np.float32), mode="F").resize(color.size, Image.BICUBIC)
    dn = np.clip(ndimage.gaussian_filter(np.asarray(df), 3), 0, 1)
    Image.fromarray((dn * 65535).astype(np.uint16)).save(BG / "depth.png")

    h, w = dn.shape
    yy, xx = np.mgrid[0:h, 0:w]
    region = (xx < w * 0.30) | (yy > h * 0.85)
    near = dn > np.quantile(dn, 0.85)
    mask = ndimage.binary_opening(near & region, iterations=4)
    mask = ndimage.binary_fill_holes(mask)
    a = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    occ = color.convert("RGBA")
    occ.putalpha(a)
    occ.save(BG / "occluder.png", optimize=True)
    print("occluder ratio", (np.asarray(a) > 20).mean())


def export_depth_rg(size=(512, 288)):
    """Browser-friendly depth: 16-bit value split into R (high) and G (low) bytes."""
    d = np.asarray(Image.open(BG / "depth.png"), np.float32) / 65535.0
    d = np.asarray(Image.fromarray(d, mode="F").resize(size, Image.BOX))
    v = np.clip(d * 65535, 0, 65535).astype(np.uint16)
    rg = np.dstack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)])
    Image.fromarray(rg).save(BG / "depth_rg.png")


if __name__ == "__main__":
    cut_poses(new_session("isnet-general-use"))
    build_background()
    export_depth_rg()
