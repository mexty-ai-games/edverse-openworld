# Biome Frontier asset scripts

Every asset of the Biome Frontier district is original and made by these scripts (numpy/Pillow
textures, headless Blender 4.2.3 models, numpy + ffmpeg sound). They reuse the Idea Grove helpers
(`../common.py`, `../textures.py`, `../render_preview.py`). Outputs, library URLs and catalogue ids are
listed in `../../manifest.biome-frontier.json`.

```bash
python3 textures.py build/tex                 # grounds, sandstone strata, mossy rock, giant leaves, palm frond, canopy, planks, thatch, bone, coral, water normal, icon signs
python3 sounds.py build/audio                 # bf_ambience.mp3 (waterfall, waves, birds; seamless 24 s loop)
export OW_TEX=build/tex OW_OUT=build/glb
blender -b --factory-startup -P make_flora.py        # jungle_tree, palm, giant_leaf_plants
blender -b --factory-startup -P make_terrain.py      # waterfall_cliff, canyon_rocks, dig_site, corals
blender -b --factory-startup -P make_structures.py   # pier, field_station, rope_bridge, signposts, trail_gate
blender -b --factory-startup -P make_species.py      # toucan, tree_frog, morpho, tortoise, horned_lizard, saguaro, sea_turtle, clownfish, sea_star
blender -b -P render_icon.py -- build/glb/toucan.glb build/icons/toucan.png 28 18   # species picture (transparent)
python3 compose_icons.py build/icons build/icons     # -> icon_<species>.jpg (field-card pictures + catalogue previews)
python3 gen_assets_ts.py                             # manifest -> game/src/zones/biome-frontier/assets.gen.ts
```

Budgets: < 20k triangles and < 5 MB per model (largest: canyon_rocks 16.1k tris, field_station 1.6 MB).
