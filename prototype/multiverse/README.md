# Multiverse prototype (v2 concept, real time)

The v2 concept frames, rendered in the browser: one fjord, four universes, a rift you can walk through.
It is a technical and art-direction prototype for the OpenWorld v2 multiverse, not yet part of the game
block. Built on three.js `WebGPURenderer` with TSL node materials, so the same code runs on WebGPU and
falls back to WebGL 2 by itself.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5190
npm run build      # static build in dist/ (relative paths, can be hosted anywhere)
```

| URL option | Effect |
|---|---|
| `?u=glacial` | start in another universe (`prime`, `glacial`, `drowned`, `halfg`) |
| `?webgl` | force the WebGL 2 backend |
| `?q=low` | cheaper: no ambient occlusion or FXAA, fewer trees and less grass |
| `?cam=concept` | the exact camera of the Blender concept frames, for side-by-side comparison |
| `?shot` | hide the interface |
| `?no=water,forest,grass,shadows,post,portal,terrain,haze` | switch parts off (debugging) |
| `?still=N` | render N fixed-step frames, then stop (headless checks) |

Controls: WASD / arrows (ZQSD on AZERTY) to walk, Shift to run, drag to look, wheel to zoom. Walk into the
gold ring to cross to the universe it shows; `T` retunes the ring; `1`–`4` jump directly.

## How it gets the look

| Concept frame (Cycles) | Here (real time) |
|---|---|
| Nishita sky | `atmosphere.js`: Rayleigh / Mie / ozone single scattering with a transmittance table (the medium of Hillaire 2020, as in Tidewater's `Atmosphere.js`), computed once per universe on the CPU into a sky panorama; PMREM of it lights the scene |
| Mist pass | `haze.js`: aerial perspective as the scene fog node, an exponential height layer with analytic optical depth, coloured by the horizon sky in the view direction plus the sun's glow (Tidewater's `AirHaze` idea) |
| Sun lamp + soft shadows | directional light coloured by the sky's transmittance toward the sun, cascaded shadow maps |
| Same terrain | the exact heightfield, exported from the concept scene (`tools/export_scene.py`), heights and normals computed in the vertex shader so a universe can raise the mountains |
| Geometry-nodes forest | `forest.js`: procedural conifers, two levels of detail rebuilt as the camera moves, placed on the GPU from the heightfield |
| Grass particles | `grass.js`: tufts in 8 m chunks thinned with distance (Tidewater's `GrassField` tiers), wind, backlit blade tips |
| Glossy water | `water.js`: planar reflection, refraction with depth absorption, fresnel, sun glint, shoreline foam |
| Fog glow, colour balance, vignette | `post.js`: GTAO, bloom, the universe grade, vignette, AgX, FXAA |
| The rift window | the destination universe rendered from the same camera into a half-resolution target, seen through the ring |

A universe (`universes.js`) is a set of uniforms (`world.js`): sea level, mountain scale, snow line,
palette, tree and grass density, sky and haze, grade. Switching is instant, and the rift renders the
other universe in the same frame.

## Assets

`public/assets/heightfield.i16.bin` and `public/assets/props.glb` come from the concept scene. The GLB is not
committed (the repo never stores models, see ART.md): build it once before `npm run dev`:

```bash
blender -b --factory-startup -P tools/export_scene.py -- tools/concept_scene.py /tmp/out
python3 tools/pack_heightfield.py /tmp/out/heightfield.bin public/assets/heightfield.i16.bin
cp /tmp/out/props.glb public/assets/
```

The explorer, stones and lighthouse are still blockout shapes from the concept; production models are
an open decision (see the v2 concept page).

## Credits

Techniques adapted from [Tidewater](https://github.com/dgreenheck/tidewater) by Daniel Greenheck (MIT):
the atmosphere medium and transmittance table, aerial perspective from the horizon sky, distance-tiered
grass. No code or assets are copied from it.
