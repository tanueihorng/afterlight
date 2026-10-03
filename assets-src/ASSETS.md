# Asset manifest

Neutral iris surface detail, authored locally with Blender. No photographs or third-party assets.
Colour, pupil diameter, vessel patterns and condition parameters remain procedural.

Regenerate everything with `blender --background --python assets-src/build-anatomy.py`
(Blender 5.2 LTS), which runs this iris bake in-process, then authors the full anatomical
model, exports the browser assets and renders the studies into assets-src/renders/.
`eye.blend` preserves the editable sculpt, the bake receiver and the whole model scene.
`iris-normal.png` is a tangent-space normal bake; `iris-relief.png` is a linear neutral relief mask.
The scene units represent millimetres. Dimensions come from app/scripts/anatomy/export-anatomy-data.mjs.

| File | Origin | Author | Licence | SHA-256 |
|---|---|---|---|---|
| anatomy.bin | Blender BMesh/Cycles, build-anatomy.py | Afterlight project | Self-authored, project licence | 1a46a2a246b75e519e78ef4809ed382daa9b6e2e58db0fd2a035cfffcfdc5e82 |
| anatomy.json | Blender BMesh/Cycles, build-anatomy.py | Afterlight project | Self-authored, project licence | 6eb59780e270a2d3d4b402e3dec3835ef8ec9fa2d3822259a263c576e3f5fbfa |
| anatomy-data.ts | Blender BMesh/Cycles, build-anatomy.py | Afterlight project | Self-authored, project licence | 97f4a4bd7a2f0fdacf55e24a149a0c2a1fa89957f8358fd8a5ad089aa9c07871 |
| iris-normal.png | Blender Cycles, build-eye.py | Afterlight project | Self-authored, project licence | a4e00fe734f4c212a630b41e648817185eeddfbb0e4122cc4de04c60d84f5285 |
| iris-relief.png | Blender Cycles, build-eye.py | Afterlight project | Self-authored, project licence | 7038eeb0ce7e0e34bc31aa725e21b132946ec1ced5351c1f517d723319d31196 |
