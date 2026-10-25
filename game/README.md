# EdVerse OpenWorld — Idea Grove (game source)

Mirror of the EdVerse game block **`6adc7dfef7668f50f9400500`** ("EdVerse OpenWorld — Idea Grove"),
ticket 4004c0. The block's git workspace on MEXTY is the source of truth; this folder is kept in
sync with it (same `src/`, `package.json`, `webpack.config.js`, `tsconfig.json`). Template files the
game does not use or change (`src/utils/blockTracker.ts`, `src/utils/blockAnalytics.ts`, `AI.md`,
`.eslintrc`, `.prettierrc`, the template `README.md`) stay in the block and are not copied here.

- Studio: https://future.mexty.ai/edverse/studio/games/6adc7dfef7668f50f9400500
- Play-test / game test: https://future.mexty.ai/edverse/studio/games/6adc7dfef7668f50f9400500/test

## What it is

The hub of the world: a 3/4-view walk around a carved stone plaza under the giant Idea Tree.

- Start screen: 6 avatar presets (one rigged base model, tinted), a generated nickname
  `<Adjective> <Animal> <NN>` with a "New name" button. No typing anywhere. Saved with `useCloudSave("explorer")`.
- Move with WASD / arrows / ZQSD (physical keys), the on-screen stick on touch, or tap the ground.
  Collisions with the tree, stalls, telescope and boulders; the clearing is bounded (radius 19.5 m).
- Idea Tree: one glowing lantern per `lanterns` prop on the tree's hooks; tap it (or stand under it
  and press E / the action button) → "Idea by {nickname}: {title}". Hooks without an idea carry
  unlit lanterns ("waiting for a new idea").
- Stalls: Biome Frontier, Chrono Quarter, Skyharbor → "Coming soon" cards with the district art.
- Telescope (the learning activity, Science): find 3 real constellations (Big Dipper, Orion,
  Cassiopeia; star positions projected from real RA/Dec). Each find → `mexty.progress.answer`, the
  round → `mexty.progress.complete(firstTryFinds, 3)`.
- Phrase wheel: 8 preset phrases/emotes (EN/FR) shown as bubbles, with wave/cheer animations; keys 1–8.
- Presence: other explorers (avatar, nickname, bubbles) over Mexty LiveKit rooms (same technique as
  the store's multiplayer games: `POST {api}/api/livekit/token`, data topic `ow`), ~8 Hz while moving,
  1 Hz idle, interpolated. **Rooms are keyed by EdVerse age tile** (`getPlayer().ageMin/ageMax` →
  `edverse-openworld-idea-grove-t0..t4`), so explorers more than one tile apart never share an open
  room (in practice: same tile only). No age (grown-up account) or no token (guest) → the explorer
  plays alone. Tap another explorer's name tag to hide them.
- Settings: picture Auto / Fast / Nice / Best (pixel ratio, shadows, bloom/vignette, MSAA, foliage
  density, light shafts/fireflies; Auto lowers the pixel ratio if the frame rate drops), sound on/off.
  The store's `paused` stops rendering and sound; `muted` silences it.

## The first expedition (ticket 6addeddaca61b98af27f98ae)

Learning by doing, no quizzes. Props `quests[]` (the quest engine, `src/game/quests.ts`) and `expedition`
(the Grove Keeper, the field kit, the Field Guide's 12 species with 4 sourced facts each, the hand-lens features).

- **Grove Keeper** by the Idea Tree (`scene/Expedition3D.tsx`): greets new explorers after the start screen,
  reminds returning ones of their step; speech bubble with a next button and EN/FR voice lines (`keeper.lines[].audio`).
- **Quests**: Three sparks (3 glowing seeds, one behind the start view) → Field Camera + Field Guide; Your first photo
  (the tree frog on the Biome Frontier stall); Into the Biome Frontier (3 different species); Look closer (hand lens, 2 species).
- **Field Camera** (`ui/FieldKit.tsx`): viewfinder with focus ring, zoom (camera fov), shutter. A photo is a record
  `{ speciesId, behaviour, stars, at }`: 1 star in frame, +1 well framed (in the ring, 10–85 % of the frame's short side,
  ≤ 11 m away), +1 while the creature feeds or does its special behaviour. Each species keeps its best photo.
- **Field Guide**: a page per species, stages seen → photographed → identified → behaviour observed, one true fact each.
- **Hand lens**: the explorer counts legs / wings / arms and checks shell, fur, spines… on the close-up; a right observation identifies it.
- **Creatures** (`zones/biome-frontier/Creatures.tsx`, `scene/creatures.tsx`): behaviour brains with real habits; they
  flee for a moment when the explorer rushes straight at them (the camera makes the explorer tiptoe).
- Saved in one cloud-save key, `expedition`. Learning record: `mexty.progress.answer` per new guide stage and per lens check,
  `complete(stages filled, 48)` when the 4 quests are done.
- `node dev/export_expedition.mjs` builds `dev/expedition.props.json` (the saved variant's `quests` / `expedition` / `voice`)
  from `src/expedition/content.ts` + `assets/manifest.voice.json` + `assets/manifest.expedition.json`, and refreshes `dev/props.local.json`.

## Phase 2: catch, measure, dig, the Bug Games

Four more quests after "Look closer" (props `quests[]`, content in `src/expedition/phase2.ts` and `src/expedition/bugGames.ts`):

- **Catch and release** (net + jar, `ui/Catch.tsx`, `scene/HeldNet.tsx`): walk slowly up to an insect (a ring turns green when the
  net reaches it) and sweep the net along its arc (drag, or hold Space). Too fast: "try again, slowly" — no fail state. In the jar the
  explorer counts legs and body parts (insect or not: the garden snail is a mollusc), then lets it go within 4 m of where it was
  caught. The jar is never saved (leaving the zone sends it home). Field Guide stage 16 = caught and released.
- **Measure it** (tape + scale): the jar's picture lies along a real-size ruler; drag the tape from tail to head and the reading
  snaps to the real length (±12 %). The pan balance (a small 3D bench) is levelled with 5 g / 1 g / 0.1 g weights (honeybee 0.1 g,
  locust 2 g, snail 10 g). Stage 32 = measured (bit 64 = weighed). The guide's "Compare sizes" page sorts the measured creatures.
- **A real dig** (trowel + brush, Biome Frontier `zones/biome-frontier/DigBlock.tsx`, `dig.ts`): rub the trowel over the dig block to
  scrape its 4 layers away, rub the brush over each fossil to clean it; a fossil must be brushed out before digging deeper, so the
  order found is the timeline (shark tooth 15 Myr, dinosaur bone 70, ammonite 150, fern 300, trilobite 500).
- **The Bug Games** (`scene/BugGames3D.tsx`, `ui/BugGames.tsx`, west meadow of the Idea Grove): six events of real talents (long jump —
  flea, weight pull — dung beetle, sprint — tiger beetle, hide and seek — stick insect, glow show — firefly, direction dance —
  honeybee). Pick the athlete from the creatures you have found and the time of day; the scoreboard writes the result in chalk and the
  podium's leaf medal swings at the end. Every pick -> `progress.answer`, the round -> `complete(first-try events, events played)`.
- Insects live where they really do (`scene/Insects.tsx`): honeybee on lavender and monarch caterpillar on milkweed in the grove's
  south-east meadow; dung beetle, locust and tiger beetle on the canyon's sand; leafcutter ant on the rainforest trail, snail by the
  pool, firefly in deep shade (its lantern flashes every 5.5 s), camouflaged stick insect at the forest's edge. The cat flea is only a
  guest jumper in the Bug Games (never on a person).
- The save (`expedition` key) gains `rp` (quests whose complete() was sent) and `bg` (Bug Games rounds, best); old saves migrate:
  a finished first expedition stands on "Catch and release" and gets its tools with the keeper's introduction.

## Props drive everything

Every learner-facing word (`ui`, all `{ en, fr }`), the lanterns, districts, constellations,
phrases, avatar presets, nickname word lists, and every model/texture/sound URL are props.
`dev/props_source.py` builds the saved variant:

```bash
python3 dev/props_source.py <urls.json> dev/props.json   # urls.json: asset id -> URL
```

### How lanterns work

`lanterns: { nickname, title: {en, fr}, where, shippedAt }[]` — one entry per shipped idea, newest
first (the shape of `GET /api/edverse/ideas/lanterns`). Lantern *i* hangs on hook *i* of the tree
model (`hook_00..hook_17` empties, sorted so the ones facing the plaza come first); past 18, extra
lanterns hang beside the hooks (up to 36). `where` is a district id, resolved through
`districtNames`. To publish a new shipped idea, add it to the front of `lanterns` in the props
variant (`update_game_props`) — no code change.

## Run locally

```bash
npm install
# local assets (the published URLs need a signed-in MEXTY session):
#   put the .glb/.jpg/.mp3 files in dev/public/a/ and build dev/props.local.json with
#   python3 dev/props_source.py urls.local.json dev/props.local.json   (urls -> "/a/<file>")
npx vite --config dev/vite.config.ts      # http://localhost:5180  (?age=8 to join a local room;
                                           #  two tabs see each other through a BroadcastChannel)
npm run build                              # the federation bundle, as MEXTY builds it
```

Assets are built by the scripts in `../assets/blender/` (see `../assets/manifest.json`).
