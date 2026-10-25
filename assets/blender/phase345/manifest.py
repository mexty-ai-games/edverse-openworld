"""Build assets/manifest.phase345.json from catalog.py entries + upload/catalogue ledgers.

python3 manifest.py <build_dir> <phases e.g. 3,4> [--done]
Ledgers (in <build_dir>/tools): uploaded.tsv (library file name -> file id), catalogue.tsv (source file -> catalogue id).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import catalog  # noqa: E402

BASE = "https://future-api.mexty.ai/api/files/p/"
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "manifest.phase345.json")


def lib_name(src, phase):
    """Source file name -> name it was uploaded under."""
    if src.endswith(".glb"):
        return "ow-" + src[:-4].replace("_", "-") + ".glb"
    if src.startswith("sticker_"):
        return "ow-p3-" + src[:-4].replace("_", "-") + ".png"
    return src


def main():
    build, phases = sys.argv[1], [int(p) for p in sys.argv[2].split(",")]
    sys.path.insert(0, os.path.join(build, "tools"))
    from glbinfo import info
    up = dict(l.rstrip("\n").split("\t") for l in open(os.path.join(build, "tools/uploaded.tsv")) if l.strip())
    cat = dict(l.rstrip("\n").split("\t") for l in open(os.path.join(build, "tools/catalogue.tsv")) if l.strip())
    out = []
    for ph in phases:
        for e in catalog.ALL[ph]():
            ln = lib_name(e["file"], ph)
            fid = up.get(ln)
            base = e["key"].replace(":", "-")
            pre = f"ow-p{ph}-"
            icon = up.get(f"{pre}icon-{base}.png") or up.get(f"ow-p3-icon-{base}.png")
            sil = up.get(f"{pre}sil-{base}.png") or up.get(f"ow-p3-sil-{base}.png")
            rec = {"key": e["key"], "name": e["name"], "kind": e["kind"] if e["kind"] != "model" else ("creature" if e["creature"] else "model"),
                   "phase": ph, "url": BASE + fid if fid else None, "fileAssetId": fid, "catalogueAssetId": cat.get(e["file"])}
            path = os.path.join(build, "glb", e["file"]) if e["file"].endswith(".glb") else os.path.join(build, "stickers", e["file"])
            rec["sizeBytes"] = os.path.getsize(path) if os.path.exists(path) else None
            if e["file"].endswith(".glb") and os.path.exists(path):
                gi = info(path)
                if e["node"]:
                    rec["nodes"] = [e["node"]]
                    rec["triangles"] = gi["top"].get(e["node"])
                    rec["kitNodes"] = list(gi["top"].keys())
                else:
                    rec["nodes"] = list(gi["top"].keys())
                    rec["triangles"] = gi["triangles"]
                if e["clips"]:
                    rec["clips"] = e["clips"]
                    rec["allClips"] = gi["animations"]
            elif e["kind"] == "image":
                rec["width"] = rec["height"] = 128
            if icon:
                rec["iconUrl"] = BASE + icon
            if sil:
                rec["silhouetteUrl"] = BASE + sil
            rec["tags"] = e["tags"]
            if e["notes"]:
                rec["notes"] = e["notes"]
            out.append(rec)
    if "--done" in sys.argv:
        out.append({"key": "DONE"})
    hdr = {"key": "_about", "ticket": "6addeddaca61b98af27f98ae",
           "notes": ("OpenWorld phases 3-5 assets (original, Blender scripts in assets/blender/phase345). Metres, glTF +Y up, "
                     "fronts face +Z. Kit .glbs hold several top-level nodes laid out along X: clone the node named in 'nodes' and reset "
                     "its position. Creatures are real size (see notes for a readable game scale). Catalogue status: pending review.")}
    json.dump([hdr] + out, open(OUT, "w"), indent=1)
    print("wrote", OUT, len(out), "entries;", sum(1 for r in out if r.get("url")), "with url")
    missing = [r["key"] for r in out if r.get("key") != "DONE" and (not r.get("url") or not r.get("catalogueAssetId") or
                                                                     (r.get("kind") != "image" and not r.get("iconUrl")))]
    if missing:
        print("MISSING", missing)


if __name__ == "__main__":
    main()
