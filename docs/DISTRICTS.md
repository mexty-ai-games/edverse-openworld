# District module spec (ticket 7f686b)

The game (`game/`, EdVerse block `6adc7dfef7668f50f9400500`) has one hub scene, the Idea Grove
(`src/scene/World.tsx`, `src/game/layout.ts`). Each district is a **self-contained module** the
hub switches to when a player walks into its stall. District builders write ONLY inside their own
folders, so three districts can be built at the same time without touching each other's files.

## Folders a district owns
- `game/src/zones/<id>/` — all code: `index.ts` (exports below), `Scene.tsx`, `layout.ts`,
  `Activity.tsx` (DOM overlay), `types.ts` (its props schema), `content.ts` (default props, EN+FR).
- `game/dev/<id>.html` + `game/dev/<id>.tsx` — a standalone harness rendering only this district
  (copy the pattern of `game/dev/main.tsx`), for local testing with Vite and headless screenshots.
- `assets/blender/<id>/` — the scripts that made every asset (Blender headless, numpy/PIL, ffmpeg).
- `assets/manifest.<id>.json` — same entry shape as `assets/manifest.json`.

Never edit files outside these. Read anything you like (hub code is the style and quality reference).

## Ids
`biome-frontier` (props key `biomeFrontier`), `chrono-quarter` (`chronoQuarter`), `skyharbor` (`skyharbor`).

## What `zones/<id>/index.ts` exports
```ts
export const DISTRICT_ID = "<id>";
export type { <Name>Props } from "./types";          // the district's props sub-tree
export { defaultProps } from "./content";            // full EN+FR default content + asset URLs
export { Scene } from "./Scene";                      // R3F scene: <Scene props game plan onOpen onExit />
export { Activity } from "./Activity";                // DOM overlay for the learning activity
export { SPAWN, colliders, groundY, WORLD_R, EXIT } from "./layout";
```
- `Scene` receives the same `game` object and `plan` (quality) as the hub `World`, plus
  `props: <Name>Props`, `onOpen(card)` for info cards, and `onExit()` when the player steps into the
  district's exit portal/gate back to the Idea Grove. It renders ground, sky/lighting mood, models,
  foliage and interactive targets, and reuses hub helpers read-only (`scene/assets.ts` `useModel`,
  `useTiles`, `addWind`, `glowTexture`).
- Interactive targets use the hub's target pattern (`game/state.ts` `Target`); a new target kind is
  a string `"<id>:<what>"` (e.g. `"biome-frontier:dig"`), handled by your `Activity`.
- `Activity` is a full-screen or panel overlay like the hub's telescope (`ui/Sky.tsx`): kid-friendly,
  big touch targets, works on phone portrait/landscape, EN+FR via `t()`. It records learning with
  `mexty.progress.answer(...)` for every answer and `mexty.progress.complete(score, max)` at the end
  of a round (read `ui/Sky.tsx` for the exact calls). Kind feedback on mistakes, no timers, no lives.
- Every learner-facing word is a `LocalizedText {en, fr}` in the district's props. Every asset URL is
  a prop. Nothing hard-coded.

## Quality bar (product owner's rules)
- At least the hub's quality and Swarm Legends' look: painterly, textured, dense foliage/props,
  warm light, the mood of the district's concept art (ART.md). No low-poly, voxel or primitive look.
- **Every asset is new and original.** Never reuse assets from any other MEXTY game. You may reuse
  the Idea Grove's own OpenWorld assets (e.g. the kid avatar, fern, flowers, grass tuft) since they
  are OpenWorld's. Models < 20k triangles and < 5 MB each; textures shared within the district.
- Build models in headless Blender (`blender` — if missing, download the portable 4.2 LTS tarball as
  the hub builder did), textures with numpy/PIL, sounds with numpy + ffmpeg. Upload each file with
  the EDVERSE MCP `create_media_upload` → curl → `complete_media_upload`. Then
  `contribute_asset_to_catalogue` each one (license `mexty-original`, source `blender` or `made`,
  `collections: ["edverse-openworld"]`, tags incl. the district id, rightsConfirmed true). Do NOT
  approve them; the lead approves.
- Respect RULES.md: no free text, no personal data, no violence or scary content, no money.

## The learning content must be correct
Real facts only, checkable, age-appropriate for 7–12 with a simpler mode for 4–6 (icons, voice
lines later). Each district: one main activity of 6–10 questions/finds per round, replayable.
