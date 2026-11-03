# Calm Classroom Builder — Plan

A touch-first, isometric classroom builder for iPad. Students get **10 minutes** and a **budget**
to furnish a learning space, then "release" a class of virtual students (ADHD, Autistic, AuDHD,
Dyslexic) who walk in and react to the room. Scoring uses published design principles for
neurodivergent learners. Styled in GTAC branding (Figtree, eggshell/cobalt/sodium-flame palette).

Test URL: **https://renatatest.dunc.app** → Caddy → `localhost:8000` on `ubuntu@gtac:~/apps/sims`.

---

## 1. Tech choice (and why)

| Layer | Choice | Why |
|---|---|---|
| Front end | **Plain HTML + ES-module JavaScript, Canvas 2D** | Runs in iPad Safari with no install and no build step. Students and teachers can read and remix the code. Canvas copes with ~200 isometric objects easily. |
| Input | **Pointer Events** (one API for touch, pencil and mouse) | Drag from the tray, drag to move, two-finger pinch/pan, tap to select. `touch-action:none` on the canvas stops Safari scrolling or zooming. |
| Back end | **Python 3 stdlib server** (`server.py`, no pip installs) | Serves the static files and adds a small JSON API so builds are saved **centrally** (a teacher can review and compare every group's room). The server already has Python 3.12; this matches how `glitch` etc. run. |
| Storage | JSON files in `data/builds/` + `localStorage` autosave | Nothing to set up; survives a Safari reload mid-build. |
| Deploy | `deploy.sh` → tar over ssh → `systemd` unit `sims.service` | Same pattern as the other apps on gtac. Caddy block already exists. |

The app is **front-end only by design**: if the Python server is ever unavailable, `index.html`
still works from any static host. Saving to the server is the only thing you lose.

Later, if rendering gets heavy (animated students, lighting), swap Canvas 2D for **PixiJS** (loaded from a CDN, still no build step).

---

## 2. Gameplay loop

1. **Setup**: pick a preset room (Small 8×8, Standard 10×12, Large 14×14, L-shaped) or a custom grid size. Set the budget (default $8,000).
2. **Build (10:00 timer)**: drag items from the tray onto the grid. They snap to tiles, show red where they can't go, and can be rotated or deleted. Room settings: light level and type (fluorescent / LED / warm dimmable), wall colour (muted / bright / white). A running cost bar shows spend against budget.
3. **Release**: the timer ends (or the student taps *Release*). Virtual students enter through the door, walk to their preferred spot (Phase 2 animation), and react with speech bubbles.
4. **Report**: a score per student plus an overall score, each principle explained in plain words ("Ari found nowhere quiet to retreat to"). Save to the server, then compare builds on a gallery page.

---

## 3. Catalogue (Beparta furniture, AUD RRP)

All furniture comes from **Beparta** (https://beparta.com.au): ~45 classroom-relevant products,
chosen from their 325, using their names, product codes and listed prices (Nov 2026). **1 grid tile = 600 mm**;
footprints are rounded from Beparta's W×D sizes. The standard room is 14 × 12 tiles (8.4 × 7.2 m).
The budget can be $15k, $25k (default) or $40k. Everything is in `public/js/catalog.js`, and each item
has `seats` (how many students it holds) and scoring tags.

- **Desks**: Individual/Double Student desks, adjustable desks and tray desks, Quarter and Cloud group tables, Perch standing bench, carrel table, teacher desks
- **Seating**: student chairs, sled/upholstered stools, Rockable Seat, Beparta Board (balance)
- **Soft**: Beparta Lounges, BECOMFY, ottomans, cube/hexagon seats, Crash Mat, Grass Collection, rugs
- **Quiet & sensory**: Sensory Comfort Nook, Hooded Seat, BEZONE Pod, BEHOUSE Cubby, Collab-Pod, Sensory Exploration Carrel, Sensory Table, Room Divider
- **Storage & books**: bookcases, book display, shelving, tote caddy, bag storage, Storage Planter Unit, mobile whiteboard
- **Generic supports** (not sold by Beparta, placeholder prices): headphone station, dimmable lamp, bubble tube, weighted blankets, visual timetable, fidget tub, acoustic screen, plants, class pet, Lego table, toy box

To refresh prices, Beparta's public WooCommerce Store API lists every product with its price:
`https://beparta.com.au/wp-json/wc/store/v1/products?per_page=100&page=N`.

**Students are never labelled with a diagnosis in the app.** Each one is described only by
what they need ("Always on the move", "Needs calm and quiet", "Needs to move and to rest",
"Reads best in good light"). The research mapping in §4 stays in this document for teachers.

---

## 4. Scoring model (research basis)

Main frameworks:

- **ASPECTSS Design Index** (Magda Mostafa, 2008/2014). Seven principles for autism-friendly design: **A**coustics, **S**patial sequencing, **P**ersonal **E**scape space, **C**ompartmentalisation, **T**ransition zones, **S**ensory zoning, **S**afety.
- **Clever Classrooms / HEAD study** (Barrett et al., Univ. of Salford, 2015). Classroom design explained about 16% of the variation in learning progress. Its factors were *Naturalness* (light, air, temperature), *Individualisation* (ownership, flexibility) and *Stimulation* (moderate complexity and colour; both too little and too much hurt).
- **Universal Design for Learning** (CAST): give choice in how and where students work.
- **Dyslexia-friendly guidance** (British Dyslexia Association style guide; classroom practice): good glare-free light, low visual clutter, audio and reading supports, a calm reading area.
- **ADHD classroom accommodations**: movement options (wobble stools, standing desks), fidget access, seats away from doors and windows, clear zones, reduced visual distraction.
- **AuDHD**: needs often *conflict* (wants stimulation and movement **and** low sensory load), so this student scores high only when the room has **both** an active zone and a retreat zone, kept well apart.

> Before it goes in front of students: check the citations and weights with a specialist teacher or OT. The weights are in `js/scoring.js`.

### Principles the engine measures (0–1 each)

| Principle | How it's computed from the room |
|---|---|
| Acoustics | absorbing items (panels, rugs, soft seating, headphones) per floor area, minus noisy items |
| Escape space | a quiet nook or tent exists, sits far from the door, and has no noisy item within 3 tiles |
| Sensory zoning | mean distance between "loud" (toys, fidget, movement) and "calm" (quiet, books) items, scaled to room size |
| Circulation / transition | every item reachable from the door by flood fill; ≥ 35% of floor kept clear |
| Movement & fidget | wobble stools, standing desks, fidget stations |
| Seating choice | number of distinct seating types (≥ 4 = full marks) |
| Lighting | light level/type compared with each student's comfort band; dimmable lamps help everyone |
| Visual calm | wall colour + item density (clutter) − storage that tidies |
| Nature | plants, pets, planters |
| Reading support | books, reading corner, good light |
| Budget | over budget → penalty |

Each student type is a **weighted mix** of these principles plus their own comfort bands, so the
same room gives different results for different students.

| Student | Biggest weights |
|---|---|
| ADHD | movement & fidget, sensory zoning, visual calm, seats away from door/window |
| Autistic (ASD) | acoustics, escape space, lighting (low, warm, no flicker), visual calm, predictability |
| AuDHD | escape space **and** movement, sensory zoning (strong), acoustics |
| Dyslexia | lighting (bright, no glare), reading support, visual calm, seating choice |

---

## 5. Milestones

| # | Milestone | Ships |
|---|---|---|
| **v0** (this deploy) | Core builder | Isometric grid, presets, drag from the tray, snap, move, rotate, delete, pinch-zoom/pan, cost bar, light and wall settings, 10-min timer, first scoring pass and report, save to server, GTAC styling |
| v1 | Students come alive | Animated students walk from the door (A* on the grid), sit in preferred spots, emoji reactions and speech bubbles, named student cards with traits |
| v2 | Richer building | Wall items (windows, panels, timetable on the wall), L-shaped rooms and zones painted on the floor, indoor–outdoor door, undo/redo, multi-select, item variants and colours |
| v3 | Classroom use | Teacher gallery/compare page, class code for groups, export a PNG of the room, printable report, configurable budget and timer per session |
| v4 | Polish | Sprite art in place of boxes, sound (optional, off by default), accessibility pass (big touch targets, reduced motion, colour-blind-safe status colours) |

## 6. Testing

- **iPad Safari** (the target): drag, pinch, rotate; no page scroll or zoom mid-drag; landscape and portrait.
- Desktop Chrome with a mouse (teacher demo).
- A scoring sanity suite: an empty room scores low, a "textbook" room scores high, each student type responds to its key principle (`tests/scoring.html` runs in the browser).
- Deploy every test build to renatatest.dunc.app with `./deploy.sh`.

## 7. Files

```
public/index.html       app shell (GTAC header, tray, toolbar, canvas)
public/css/app.css      GTAC tokens + touch-sized UI
public/js/catalog.js    items, prices, tags, footprints
public/js/iso.js        isometric maths, 4-angle view rotation, drawing, sprite hook
public/js/scoring.js    principles, student profiles, report text
public/js/main.js       state, input (pointer events), UI wiring, save/load
server.py               stdlib static server + /api/builds (saves to data/builds/)
deploy.sh               tar → gtac, install/restart sims.service
sims.service            systemd unit
```

## 8. Rendering & asset budget (fast loading)

- **No 3D at runtime.** The camera rotates in **90° steps only** (4 views). Each item needs at
  most 4 pre-rendered facings; symmetric items (plants, stools) need 1.
- **Sprites, not meshes.** Items and students are pre-rendered PNG/WebP (from Blender, hand-drawn
  or generated, all done offline), packed into **one WebP atlas per category**, ~128 px per facing
  at 2× DPR. Target **≤ 60 KB per atlas**, loaded only when that tray tab is first opened.
  `iso.js` already has the `SPRITES[id][facing]` hook; boxes are the fallback.
- **Animated students**: sprite sheets of 4 directions × 6–8 walk frames plus idle/sit/react poses
  (≈ 40 KB each as WebP). Played on the canvas at 12 fps; paths come from A* on the grid.
- **Page weight**: no framework, no build. HTML + JS + CSS currently ≈ 60 KB uncompressed (≈ 19 KB
  gzipped). The font is Figtree 400/700 (self-host the woff2 in v4 to save the Google round trips).
- **Caddy**: add `encode zstd gzip` to the `renatatest.dunc.app` block.
- **Budget**: first paint < 100 KB transferred; full sprite set < 600 KB.
