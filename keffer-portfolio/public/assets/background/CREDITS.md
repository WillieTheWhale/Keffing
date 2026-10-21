# Background (ALLOY): asset credits

Everything in this folder is derived from the site's own sky photographs in
`public/assets/sky/` (see `public/assets/sky/CREDITS.md` for their sources and
licences: Unsplash originals, NASA public-domain orbital imagery, a CC0
Wikimedia contrail) or generated procedurally. No external assets were added.

| file | made by | from |
|---|---|---|
| `env-sky.jpg`, `env-sky-1k.jpg` | `scripts/background/make_env.py` | sky-4 + sky-1 (upper dome), procedural horizon haze, dark ground and softbox strips |
| `env-white.jpg`, `env-white-1k.jpg` | `scripts/background/make_env_white.py` | sky-4, sky-14, sky-1, sky-10 in a procedural "white room" (softboxes, mullions, floor) |
| `panels/*.webp` | `scripts/background/make_panels.py` | crops + grades of sky-5, sky-9, sky-6, sky-13, sky-17, sky-8, sky-16, sky-12 |
| `paper-grain.png` | `scripts/background/make_panels.py` | procedural noise + fibres |
| `graphite-nucleus.png`, `graphite-contact.png` | `scripts/background/make_graphite.py` | procedural pencil scribble and paper tooth |
| `end-sky.jpg`, `end-sky-1k.jpg` | `scripts/background/make_endsky.py` | sky-10, re-graded into the cobalt palette |
| `components/background/asciiSky.ts` | `scripts/background/make_ascii.py` | typed renderings of sky-7, sky-18 (NASA), sky-19 (NASA) |

The look was developed by studying the work of the artist aletiune; no pixels
from her work are used anywhere.
