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
