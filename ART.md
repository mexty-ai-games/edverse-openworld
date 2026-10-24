# EdVerse OpenWorld — Art direction (v1, 24 Oct 2026)

**One look for the whole world: painterly, hand-textured 3D, at least the quality of Swarm Legends.**
No low-poly, no voxel, no procedural primitive art.

## The look

- Real `.glb` models with PBR materials and hand-painted textures; tiling ground textures; bevels and
  worn edges — nothing reads as a raw primitive.
- Dense, layered foliage (ferns, wildflowers, moss on stone), warm dappled sunlight, soft fog for
  depth, bloom on light sources.
- Saturated but natural colours; each district keeps one dominant light mood.
- Characters: stylised kids of many looks and abilities, readable silhouettes at a 3/4 camera.
- UI: the Swarm Legends family — warm parchment cards, bold rounded display type, big touch targets.
- Quality settings auto / low / medium / high (pixel ratio, extras, post-processing) so phones hold
  their frame rate. Models under ~20k triangles and 5 MB each; textures shared across districts.

## Districts

| District | Learns | Mood | Concept |
|---|---|---|---|
| **Idea Grove** (hub) | community, every subject's doorway | golden afternoon, lanterns | ![Idea Grove](https://content.mext.app/uploads/dd313761-dbc1-4c94-b64a-6f515e9d969c.png) |
| **Biome Frontier** | science, geography | bright, sea haze | ![Biome Frontier](https://content.mext.app/uploads/742bab29-d5ed-4458-9911-5c2c9ae774de.png) |
| **Chrono Quarter** | history | warm dusk, haze | ![Chrono Quarter](https://content.mext.app/uploads/a47b88b7-f930-4c09-96e5-d1ffeec56d33.png) |
| **Skyharbor** | space, engineering, coding | night, bioluminescent glow | ![Skyharbor](https://content.mext.app/uploads/679b2158-b1c4-483a-a031-b915b270fc09.png) |

The Idea Tree in the hub is the world's memory: every shipped idea hangs on it as a lantern with
its author's nickname.

## Making assets

**Never reuse assets from existing MEXTY games.** OpenWorld grows MEXTY's catalogue instead of
borrowing from it: every asset is new, original, and contributed to the shared **MEXTY Asset
Catalogue** (collection `edverse-openworld`), where any creator can then use it.

1. Search the catalogue first (`search_asset_catalogue`) — an approved asset someone contributed to
   the catalogue is fair to use; an asset that only lives inside another game is not.
2. Otherwise build it in Blender (headless script kept in `assets/blender/`), detailed — bevel,
   subdivide, sculpted noise, PBR — upload it with `create_media_upload` → `complete_media_upload`,
   and pass the URL as a prop.
3. Generated 3D models only when Blender cannot reach the look, and always re-textured to match.
4. Contribute it: `contribute_asset_to_catalogue` with tags, `collections: ["edverse-openworld"]`,
   licence `mexty-original`, and record it in `assets/manifest.json`. Staff review it; once
   approved it is public and usable by every MEXTY game.

Every asset must be ours or licensed for reuse (EV-RIGHTS). Never bundle a model into the code; it
is always a prop URL.
