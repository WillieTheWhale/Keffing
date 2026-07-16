# Texture Credits

## matcap-chrome-a.webp / matcap-chrome-b.webp
Generated 2026-07-16 by ray-tracing a mirror sphere against a real environment map —
this is the standard "render a chrome ball" matcap technique, done offline against
genuine HDRI light data rather than a hand-authored gradient.

- Source HDRI: **"Studio Small 03"** by Poly Haven (polyhaven.com), **CC0** license.
  `https://polyhaven.com/a/studio_small_03` — 1k `.hdr`.
- Build script: `scripts/asset-tools/make_matcap.py` (Radiance HDR decoder +
  mirror-sphere reflection render + Reinhard tonemap).
- Post-processing: desaturated 85% and cool-tinted to match the site's strict
  white/black/cyan/signal-red palette (same cold-grade treatment used on
  `public/assets/sky/`). Two rotations (`-a`, `-b`) for organic variety between
  stroke categories in `ChromeTendrilsGL`.

Used by the WebGL chrome-tendril shader (`components/canvas/LineCanvas.tsx` /
`lib/chromeTendrils.ts`) — per-vertex fake tube normals sample this texture so
reflections continuously follow the curvature of each stroke, not a flat map.

## brush/stroke.webp, brush/stroke2.webp
Pre-existing bristle/ink textures (see git history), used for the mesh-warped
brush-stroke overlay on the 2D canvas fallback path.
