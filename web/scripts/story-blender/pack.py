"""Pack rendered shots into the web image sequence: WebP frames + manifest with the screen corners per frame.

python pack.py --out web/public/story/seq office=RENDER_DIR_DESKTOP,RENDER_DIR_PORTRAIT [next=...]
Shots are appended in the given order; each needs <dir>/<shot>.json and <dir>/<shot>_0000.jpg … from scene.py.
"""
import argparse
import json
import os

from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--quality", type=int, default=74)
ap.add_argument("shots", nargs="+")
a = ap.parse_args()

manifest = {"version": 1, "variants": {}}
# portrait frames are used only when every shot has them; until then phones get the landscape sequence (cover-cropped)
portrait_ok = all(os.path.exists(os.path.join(sp.split("=", 1)[1].split(",")[1], sp.split("=")[0] + ".json")) for sp in a.shots)
for variant, idx in (("d", 0), ("m", 1)):
    if variant == "m" and not portrait_ok:
        manifest["variants"]["m"] = dict(manifest["variants"]["d"], dir="d")
        print("m: Hochformat unvollständig, Handy nutzt die Desktop-Bilder")
        continue
    os.makedirs(os.path.join(a.out, variant), exist_ok=True)
    frames, shots, total = [], [], 0
    size = None
    for spec in a.shots:
        name, dirs = spec.split("=", 1)
        src = dirs.split(",")[idx]
        meta = json.load(open(os.path.join(src, f"{name}.json")))
        size = meta["size"]
        shots.append({"name": name, "start": total, "count": meta["frames"]})
        for f in range(meta["frames"]):
            im = Image.open(os.path.join(src, f"{name}_{f:04d}.jpg")).convert("RGB")
            dst = os.path.join(a.out, variant, f"{total + f:04d}.webp")
            im.save(dst, "WEBP", quality=a.quality, method=6)
            lap = meta.get("laptop", [None] * meta["frames"])[f]
            ph = meta.get("phone", [None] * meta["frames"])[f] if meta.get("phone") else None
            zs = meta.get("zones") or []
            zone = zs[f] if f < len(zs) else None
            frames.append({"laptop": lap, "phone": ph, "zones": zone})
        total += meta["frames"]
    kb = sum(os.path.getsize(os.path.join(a.out, variant, x)) for x in os.listdir(os.path.join(a.out, variant))) // 1024
    manifest["variants"][variant] = {"w": size[0], "h": size[1], "count": total, "shots": shots, "frames": frames, "kb": kb}
    print(variant, total, "frames", kb, "KB")
json.dump(manifest, open(os.path.join(a.out, "manifest.json"), "w"), separators=(",", ":"))
