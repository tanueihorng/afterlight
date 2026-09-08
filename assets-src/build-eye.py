#!/usr/bin/env python3
"""
Headless Blender build for Afterlight's baked eye assets.

    blender --background assets-src/eye.blend --python assets-src/build-eye.py

Nothing here requires a human clicking in the UI: an agent must be able to regenerate every byte,
or the committed binaries become dead weight nobody can reproduce or re-license.

What Blender owns (and only this):
  * the base anatomy mesh — sclera, corneal bulge, limbal transition, lens, eyelids
  * sculpted detail baked to normal / AO / curvature maps
  * Phase 07's procedure animations, which are scripted sequences rather than states

What stays procedural in the engine, and must never be baked:
  * iris colour, pupil diameter, scleral vessel density
  * the whole fundus — vessel tree, cup:disc, macular pigment
  * every Phase 07 severity parameter
Baking a parameter produces a combinatorial explosion of assets and kills the severity slider,
which is the most explanatory interaction in the app.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys

try:
    import bpy
except ImportError:  # pragma: no cover - only meaningful inside Blender
    print("This script must be run inside Blender: blender --background eye.blend --python build-eye.py")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "src", "engine", "assets")

# Three tiers matching the engine's quality tiers. The standalone offline build uses `low`.
TIERS = {
    "low": {"decimate": 0.25, "texture": 1024},
    "medium": {"decimate": 0.55, "texture": 1024},
    "high": {"decimate": 1.0, "texture": 2048},
}


def ensure_out() -> None:
    os.makedirs(OUT, exist_ok=True)


def bake_maps(tier: str, size: int) -> list[str]:
    """Bake the sculpted detail down to normal, AO and curvature maps."""
    written = []
    for pass_name, bake_type in (("normal", "NORMAL"), ("ao", "AO")):
        image = bpy.data.images.new(f"eye_{pass_name}_{tier}", width=size, height=size)
        bpy.context.scene.cycles.bake_type = bake_type
        bpy.ops.object.bake(type=bake_type)
        path = os.path.join(OUT, f"eye_{pass_name}_{tier}.png")
        image.filepath_raw = path
        image.file_format = "PNG"
        image.save()
        written.append(path)
    return written


def export_geometry(tier: str, ratio: float) -> str:
    """Decimate to the tier's budget and export compressed glTF."""
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        modifier = obj.modifiers.new(name="tier", type="DECIMATE")
        modifier.ratio = ratio

    path = os.path.join(OUT, f"eye_{tier}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_apply=True,
    )

    for obj in bpy.context.scene.objects:
        for modifier in list(obj.modifiers):
            if modifier.name == "tier":
                obj.modifiers.remove(modifier)
    return path


def sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    ensure_out()
    written: list[str] = []
    for tier, settings in TIERS.items():
        written.append(export_geometry(tier, settings["decimate"]))
        written.extend(bake_maps(tier, settings["texture"]))

    manifest = {
        os.path.basename(path): {
            "sha256": sha256(path),
            "bytes": os.path.getsize(path),
        }
        for path in written
    }
    manifest_path = os.path.join(OUT, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)
        handle.write("\n")

    print(f"wrote {len(written)} assets")
    for name, entry in sorted(manifest.items()):
        print(f"  {name}  {entry['bytes']} bytes  sha256:{entry['sha256'][:16]}…")
    print("Update assets-src/ASSETS.md with these hashes, then run: npm run verify:assets")


if __name__ == "__main__":
    main()
