# Expedition assets (phase 1 "The first expedition")

Original assets for the Grove Keeper quest, the Field Camera / Field Guide and the living Biome Frontier
species. Outputs, URLs and catalogue ids: `../../manifest.expedition.json`.

```bash
python3 textures.py build/tex            # paint, fur, scalesoft, leather, canvas, paper (+ Idea Grove / Biome Frontier textures)
export OW_TEX=build/tex OW_OUT=build/glb
blender -b --factory-startup -P make_keeper.py          # keeper.glb: idle, wave, talk, point
blender -b --factory-startup -P make_species.py         # sloth, bighorn, octopus (idle, move, feed, special)
blender -b --factory-startup -P make_species_remake.py  # toucan, tree_frog, morpho, tortoise, horned_lizard, sea_turtle, clownfish, sea_star
blender -b --factory-startup -P make_kit.py             # spark, field_camera, hand_lens, field_guide (+ _icon_* helpers)
DIST=2.9 NOSHADOW=1 blender -b -P render_icon.py -- build/glb/toucan.glb render/toucan.png -30 12 512
python3 compose_icons.py icons render icons toucan ...  # 256 px icon + _silhouette per name
```

`xrig.py` holds the shared kit: sculpted blobs/tubes/capsules, painterly vertex colour, and `Rig` (bones,
rigid or chain-smooth skinning, clips sampled from functions of t with rotations about armature axes).
