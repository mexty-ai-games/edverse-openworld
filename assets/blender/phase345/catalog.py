"""Catalogue of every phase 3-5 asset: manifest key, display name, source .glb / node, clips, tags.

python3 catalog.py icons <phase> <build_dir>    render 256 px icons (+ silhouettes for creatures)
python3 catalog.py list <phase>                 print the entries
Each entry: key, name, file (glb in build/glb or png), node (kit node or None), clips, creature, tags, notes.
Kit entries share one .glb (and one catalogue asset); the node says which part to clone.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANTS = ["sunflower", "lavender", "foxglove", "clover", "tomato", "milkweed"]
POLL = {"sunflower": ["bumblebee"], "lavender": ["bumblebee", "hoverfly"], "foxglove": ["bumblebee", "hummingbird"],
        "clover": ["bumblebee", "hoverfly"], "tomato": ["bumblebee"], "milkweed": ["monarch"]}
STAGES = ["sprout", "young", "flowering"]


def E(key, name, file, node=None, clips=None, creature=False, tags=(), notes="", kind="model", phase=3):
    return dict(key=key, name=name, file=file, node=node, clips=clips, creature=creature, tags=list(tags), notes=notes, kind=kind, phase=phase)


def phase3():
    out = []
    out.append(E("garden:bed", "Raised garden bed (empty)", "p3_bed_empty.glb", tags=["garden", "raised-bed", "wood"],
                 notes="1.6 x 0.9 m, rails 0.37 m high."))
    out.append(E("garden:bed:soil", "Raised garden bed with soil", "p3_bed_soil.glb", tags=["garden", "raised-bed", "soil"],
                 notes="Empties plot_0..plot_5 = planting spots (soil surface y=0.35)."))
    out.append(E("garden:watering-can", "Watering can", "p3_watering_can.glb", tags=["garden", "watering-can", "tool"]))
    for p in PLANTS:
        out.append(E(f"garden:seed-packet:{p}", f"Seed packet ({p})", "p3_seed_packets.glb", node=f"packet_{p}",
                     tags=["garden", "seed-packet", p], notes="Kit node; picture-only packet front (no text)."))
    for p in PLANTS:
        for s in STAGES:
            out.append(E(f"plant:{p}:{s}", f"{p.capitalize()} ({s})", f"p3_plant_{p}.glb", node=f"{p}_{s}",
                         tags=["garden", "plant", p, s], notes=(f"Child empty {p}_visit = where {', '.join(POLL[p])} feed."
                                                                 if s == "flowering" else "")))
    out.append(E("pollinator:bumblebee", "Bumblebee", "p3_bumblebee.glb", clips=["idle", "fly", "feed"], creature=True,
                 tags=["pollinator", "bumblebee", "insect", "bee"], notes="Real size (2.5 cm): scale x4 in game. Visits sunflower, lavender, foxglove, clover, tomato."))
    out.append(E("pollinator:hummingbird", "Hummingbird", "p3_hummingbird.glb", clips=["idle", "fly", "feed"], creature=True,
                 tags=["pollinator", "hummingbird", "bird"], notes="Real size (9 cm): scale x2-3. Visits foxglove (tubular flowers)."))
    out.append(E("pollinator:hoverfly", "Hoverfly", "p3_hoverfly.glb", clips=["idle", "fly", "feed"], creature=True,
                 tags=["pollinator", "hoverfly", "insect", "fly"], notes="Real size (1.1 cm): scale x5. Harmless wasp mimic. Visits lavender, clover."))
    out.append(E("pollinator:monarch", "Monarch butterfly", "p3_monarch.glb", clips=["idle", "fly", "feed", "move", "special"], creature=True,
                 tags=["pollinator", "monarch", "butterfly", "migration"],
                 notes="Real size (10 cm span): scale x2-3. Feeds on milkweed. move = migration flap-glide, special = winter roost."))
    out.append(E("museum:building", "Explorers' Museum (timber and glass gallery)", "p3_museum_building.glb",
                 tags=["museum", "building", "gallery", "timber", "glass"],
                 notes="12 x 8 m, floor at y=0.4, open front doorway + ramp. Empties spot_00..spot_11 (display spots, -Z facing in), entrance."))
    out.append(E("museum:frame", "Photo-card frame on a stand", "p3_museum_frame.glb", tags=["museum", "frame", "easel", "photo"],
                 notes="Mesh photo_card (0-1 UV) = the card face: draw the photo card texture onto it."))
    out.append(E("museum:case", "Display case", "p3_display_case.glb", tags=["museum", "display-case", "glass"],
                 notes="Empty item_slot on the velvet (y=0.97)."))
    out.append(E("museum:plinth", "Display plinth", "p3_plinth.glb", tags=["museum", "plinth", "pedestal"], notes="Empty item_slot (y=1.03)."))
    out.append(E("museum:sticker-board", "Sticker board", "p3_sticker_board.glb", tags=["museum", "sticker", "board", "cork"],
                 notes="Empty sticker_area: cork centre, 1.1 x 0.62 m usable, board front faces +Z (glTF)."))
    for s in ["wow", "heart-leaf", "star", "sparkle", "laugh", "clap"]:
        out.append(E(f"sticker:{s}", f"Museum sticker: {s}", f"sticker_{s}.png", tags=["sticker", "museum", "reaction", s], kind="image",
                     notes="128 px PNG, transparent."))
    out.append(E("bioblitz:banner", "BioBlitz event banner", "p3_bioblitz_banner.glb", tags=["bioblitz", "banner", "event"],
                 notes="Mesh banner_cloth (0-1 UV) can take another texture."))
    out.append(E("bioblitz:totem", "BioBlitz progress totem", "p3_progress_totem.glb", tags=["bioblitz", "totem", "progress", "glow"],
                 notes="Node totem_fill: emissive column, origin at bottom; set scale.y 0..1. Node totem_crown glows at 100%."))
    for t, c, sh in (("leaf", "green", "circle"), ("drop", "sky-blue", "hexagon"), ("sun", "orange", "shield"), ("flower", "pink-purple", "scallop")):
        out.append(E(f"bioblitz:badge:{t}", f"Team badge ({c} {t})", "p3_team_badges.glb", node=f"badge_{t}",
                     tags=["bioblitz", "badge", "team", c], notes=f"Kit node; {sh} shape, Okabe-Ito colour, icon {t}."))
    return out


def phase4():
    out = []
    R = [("kiln", "Lime kiln"), ("trough", "Mixing trough"), ("ash", "Volcanic ash pile (pozzolana)"), ("bucket", "Water bucket"),
         ("mould", "Wooden mould"), ("block", "Roman concrete block")]
    for k, n in R:
        out.append(E(f"craft:rome:{k}", n, f"p4_rome_{k}.glb", tags=["craft", "rome", "roman-concrete", k, "chrono-quarter"], phase=4))
    J = [("bark", "Kozo bark bundle"), ("pot", "Boiling pot"), ("vat", "Vat with paper pulp"), ("screen", "Bamboo screen (sugeta)"),
         ("board", "Drying board"), ("sheet", "Washi sheet")]
    for k, n in J:
        out.append(E(f"craft:edo:{k}", n, f"p4_edo_{k}.glb", tags=["craft", "edo", "washi", k, "chrono-quarter"], phase=4))
    out.append(E("craft:maya:pod", "Cacao pod (closed)", "p4_maya_pods.glb", node="cacao_pod_closed", tags=["craft", "maya", "cacao", "pod"], phase=4))
    out.append(E("craft:maya:pod-open", "Cacao pod (open, beans)", "p4_maya_pods.glb", node="cacao_pod_open", tags=["craft", "maya", "cacao", "pod"], phase=4))
    M = [("metate", "Metate grinding stone with mano"), ("pot", "Clay pot"), ("vessel", "Tall pouring vessel with foam"), ("cup", "Frothy cacao cup")]
    for k, n in M:
        out.append(E(f"craft:maya:{k}", n, f"p4_maya_{k}.glb", tags=["craft", "maya", "cacao", k, "chrono-quarter"], phase=4))
    for k, n, node in (("rome", "Roman concrete block (museum display)", "display_rome_block"), ("edo", "Washi sheet (museum display)", "display_edo_sheet"),
                       ("maya", "Frothy cacao cup (museum display)", "display_maya_cup")):
        out.append(E(f"craft:{k}:display", n, "p4_craft_displays.glb", node=node, tags=["craft", "museum", "display", k], phase=4,
                     notes="Kit node: the finished object on a small labelled stand (icon plate, no text)."))
    for s, n in (("small", "Parcel crate (small)"), ("medium", "Parcel crate (medium)"), ("large", "Parcel crate (large)")):
        out.append(E(f"courier:crate:{s}", n, "p4_courier_crates.glb", node=f"crate_{s}", tags=["courier", "crate", "parcel", s, "skyharbor"], phase=4,
                     notes="Kit node; icon labels only (this-way-up, fragile, parts, seeds)."))
    out.append(E("courier:board", "Delivery board", "p4_delivery_board.glb", tags=["courier", "board", "delivery", "skyharbor"], phase=4,
                 notes="Mesh board_face (0-1 UV) can show live jobs."))
    out.append(E("courier:robot2", "Courier robot (second friendly robot)", "p4_courier_robot.glb", clips=["idle", "move", "special"],
                 creature=True, tags=["courier", "robot", "skyharbor", "friendly"], phase=4,
                 notes="Hover-bot with a cargo basket; special = happy delivery spin. Bone basket can carry a crate (child node)."))
    return out


def phase5():
    out = []
    out.append(E("season:monarch", "Monarch migration (autumn)", "p3_monarch.glb", clips=["idle", "move", "special"], creature=True,
                 tags=["season", "autumn", "monarch", "migration"], phase=5,
                 notes="Same model as pollinator:monarch - instance it for a flock (move = migration glide, special = roost)."))
    out.append(E("season:robin", "European robin (winter)", "p5_robin.glb", clips=["idle", "move", "special"], creature=True,
                 tags=["season", "winter", "robin", "bird"], phase=5, notes="Real size 14 cm: scale x2. special = singing."))
    out.append(E("season:swallow", "Barn swallow (spring)", "p5_swallow.glb", clips=["idle", "move", "special"], creature=True,
                 tags=["season", "spring", "swallow", "bird", "migration"], phase=5, notes="Real size 18 cm: scale x2. move = flight loop, special = swoop."))
    out.append(E("season:cicada", "Cicada (summer)", "p5_cicada.glb", clips=["idle", "move", "special"], creature=True,
                 tags=["season", "summer", "cicada", "insect"], phase=5, notes="Real size 4 cm: scale x3. special = singing (tymbal buzz)."))
    for i in range(3):
        out.append(E(f"season:leaf-pile:{i}", f"Autumn leaf pile {i + 1}", "p5_leaf_piles.glb", node=f"leaf_pile_{i}",
                     tags=["season", "autumn", "leaves", "set-dressing"], phase=5))
    for i, s in enumerate(("small", "medium", "large")):
        out.append(E(f"season:snow-cap:{s}", f"Snow cap for rocks ({s})", "p5_snow_caps.glb", node=f"snow_cap_{s}",
                     tags=["season", "winter", "snow", "set-dressing"], phase=5, notes="Sits on top of a rock: scale to the rock's top."))
    for i in range(3):
        out.append(E(f"season:blossom:{i}", f"Spring blossom cluster {i + 1}", "p5_blossoms.glb", node=f"blossom_{i}",
                     tags=["season", "spring", "blossom", "set-dressing"], phase=5, notes="Hang on branches; blossom_2 is fallen petals on the ground."))
    out.append(E("photo:board", "Photo challenge board", "p5_photo_board.glb", tags=["photo", "challenge", "board", "weekly"], phase=5,
                 notes="Mesh board_face (0-1 UV) can show this week's theme."))
    out.append(E("expedition:flag", "Class expedition flag post", "p5_expedition_flag.glb", clips=["wave"], tags=["class", "expedition", "flag"], phase=5,
                 notes="Mesh flag_cloth (0-1 UV); clip wave."))
    return out


ALL = {3: phase3, 4: phase4, 5: phase5}


def icon_jobs(entries, build):
    jobs, sil = [], []
    for e in entries:
        if e["kind"] != "model":
            continue
        base = e["key"].replace(":", "_")
        glb = os.path.join(build, "glb", e["file"])
        node = e["node"] or "-"
        yaw, elev = (-30, 18)
        if e["key"].startswith("museum:building"):
            yaw, elev = (-28, 22)
        sy, se = -90, 5
        if "pods" in e["file"]:
            yaw, elev = (-20, 50)
        if "monarch" in e["file"]:
            yaw, elev, sy, se = -25, 55, 0, 88
        jobs.append(f"{glb}|{node}|{build}/icons/{base}.png|-|0|{yaw}|{elev}|1|1.05")
        if e["creature"]:
            sil.append(f"{glb}|{node}|{build}/sil/{base}_raw.png|-|0|{sy}|{se}|0|1.05")
    return jobs, sil


if __name__ == "__main__":
    cmd, ph = sys.argv[1], int(sys.argv[2])
    entries = ALL[ph]()
    if cmd == "list":
        print(json.dumps(entries, indent=1))
    elif cmd == "icons":
        build = sys.argv[3]
        os.makedirs(build + "/icons", exist_ok=True)
        os.makedirs(build + "/sil", exist_ok=True)
        jobs, sil = icon_jobs(entries, build)
        sys.path.insert(0, HERE)
        import sheet
        sheet.render(jobs + sil, 256)
        from PIL import Image
        for j in sil:  # silhouette: the side-view shape filled with one ink colour, soft edge kept
            raw = j.split("|")[2]
            a = Image.open(raw).convert("RGBA").split()[3]
            ink = Image.new("RGBA", a.size, (44, 52, 66, 255))
            ink.putalpha(a.point(lambda v: 255 if v > 90 else int(v * 2.8)))
            ink.save(raw.replace("_raw.png", ".png"))
            os.remove(raw)
        sheet.compose(f"{build}/prev/icons_phase{ph}.jpg", [j.split("|")[2] for j in jobs] +
                      [j.split("|")[2].replace("_raw.png", ".png") for j in sil], 160, cols=10)
