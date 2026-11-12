Rock056 — ambientCG (CC0)

Five JPEGs downloaded unchanged from the user-specified ambientCG-Web CDN.
All are actually2048x1024. Color is sRGB; other maps are linear data.
Displacement image is used as a subtle combined bump (.01), not vertex displacement.
Natural-spacing correction: full image nominally occupies10x5 world-XZ units,
rotated.37rad and continuously warped with four sine evaluations (no extra texture taps).
All five repeats remain identity(1,1); the actual shared shader UV performs scaling
and de-repetition for color/normal/roughness/height/AO together. Raw UV/uv2 remain world XZ.
DirectX normal uses normalScale=(1,-1); AO channel2 uses copied uv2.
See source-manifest.json for exact URLs/base, hashes and sizes.
