# Asset manifest

Neutral iris surface detail, authored locally with Blender. No photographs or third-party assets.
Colour, pupil diameter, vessel patterns and condition parameters remain procedural.

Regenerate with `blender --background --python assets-src/build-eye.py` (Blender 5.2 LTS).
`eye.blend` preserves the editable high-resolution sculpt and the polar-UV bake receiver.
Run `blender --background assets-src/eye.blend --python assets-src/preview-eye.py` for the
full eye scene and the separate Cycles material study.
`iris-normal.png` is a tangent-space normal bake; `iris-relief.png` is a linear neutral relief mask.
The scene units represent millimetres. Dimensions are read from `dimensions.ts`.

| File | Origin | Author | Licence | SHA-256 |
|---|---|---|---|---|
| iris-normal.png | Blender Cycles, build-eye.py | Afterlight project | Self-authored, project licence | a4e00fe734f4c212a630b41e648817185eeddfbb0e4122cc4de04c60d84f5285 |
| iris-relief.png | Blender Cycles, build-eye.py | Afterlight project | Self-authored, project licence | 7038eeb0ce7e0e34bc31aa725e21b132946ec1ced5351c1f517d723319d31196 |
