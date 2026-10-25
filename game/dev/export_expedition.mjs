// Builds the `quests` and `expedition` props (the saved variant's content) from src/expedition/content.ts,
// adds the voice-over URLs (assets/manifest.voice.json) and the new 3D assets (assets/manifest.expedition.json),
// and writes: dev/expedition.props.json (remote URLs, for update_game_props) and merges a local copy into
// dev/props.local.json (URLs -> /lib/<file id>.<ext>, the files kept in dev/public/lib).
//   node dev/export_expedition.mjs
import { build } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
// 1) the URL tables the content defaults read (src/expedition/assets.gen.ts)
{
  const rd = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : []);
  const ex = rd(path.join(root, "assets/manifest.expedition.json"));
  const vo = rd(path.join(root, "assets/manifest.voice.json"));
  const by = {};
  for (const e of ex) if (e && e.key && e.url) by[e.key] = e.url;
  // phase 2: tools, insects, the Bug Games arena, the dig block and fossils; the garden plants insects live on
  const p2 = {};
  for (const e of rd(path.join(root, "assets/manifest.phase2.json"))) if (e && e.key && e.url) p2[e.key] = e.url;
  for (const e of rd(path.join(root, "assets/manifest.phase345.json"))) {
    if (e && e.key === "plant:milkweed:flowering") p2["plant:milkweed"] = e.url;
    if (e && e.key === "plant:lavender:flowering") p2["plant:lavender"] = e.url;
  }
  const vb = {};
  for (const v of vo) if (/^ow-voice-(keeper|fact)-/.test(v.id)) vb[v.id] = v.url;
  const row = (o) => Object.keys(o).sort().map((k) => "  " + JSON.stringify(k) + ": " + JSON.stringify(o[k]) + ",").join("\n");
  const ts = [
    "// GENERATED from assets/manifest.expedition.json and assets/manifest.voice.json (dev/export_expedition.mjs) - do not edit.",
    "// Library URLs of the first expedition's original assets and voice-overs (the props defaults).",
    "export const EXP_ASSETS: Record<string, string> = {", row(by), "};", "",
    "/** Voice-over URLs by manifest id (ow-voice-keeper-<line>-<lang>, ow-voice-fact-<species>-<lang>). */",
    "export const EXP_VOICE: Record<string, string> = {", row(vb), "};", "",
    "/** Phase 2 assets by manifest key (assets/manifest.phase2.json; plant:milkweed / plant:lavender from manifest.phase345.json). */",
    "export const P2_ASSETS: Record<string, string> = {", row(p2), "};", "",
  ].join("\n");
  const tsPath = path.join(here, "../src/expedition/assets.gen.ts");
  if (!fs.existsSync(tsPath) || fs.readFileSync(tsPath, "utf8") !== ts) fs.writeFileSync(tsPath, ts);
}
// 2) the content, bundled and evaluated
const load = async (f) => {
  const out = await build({ entryPoints: [path.join(here, f)], bundle: true, write: false, format: "esm", platform: "node", loader: { ".css": "empty" } });
  return import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
};
const mod = await load("../src/expedition/content.ts");
const quests = JSON.parse(JSON.stringify(mod.defaultQuests));
const expedition = JSON.parse(JSON.stringify(mod.defaultExpedition));
const bugGames = JSON.parse(JSON.stringify((await load("../src/expedition/bugGames.ts")).defaultBugGames));
const biomeFrontier = JSON.parse(JSON.stringify((await load("../src/zones/biome-frontier/content.ts")).defaultProps));

const readJson = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);
const voice = readJson(path.join(root, "assets/manifest.voice.json"), []);
const byVoiceId = {};
for (const v of voice) byVoiceId[v.id] = v.url;
const lang = (id) => ({ en: byVoiceId[id + "-en"], fr: byVoiceId[id + "-fr"] });
// keeper lines: ow-voice-keeper-<line>-<lang>; facts: ow-voice-fact-<species>-<lang>
for (const l of expedition.keeper.lines) {
  const a = lang("ow-voice-keeper-" + l.id);
  if (a.en && a.fr) l.audio = a;
}
for (const s of expedition.species) {
  const a = lang("ow-voice-fact-" + s.id);
  if (a.en && a.fr) s.factAudio = a;
}
// the expedition's own 3D assets, once made
const ex = readJson(path.join(root, "assets/manifest.expedition.json"), []);
const byKey = {};
for (const e of Array.isArray(ex) ? ex : ex.assets || []) if (e && e.key && e.url) byKey[e.key] = e.url;
const done = (Array.isArray(ex) ? ex : []).some((e) => e && e.key === "DONE");
// manifest keys use underscores (species:tree_frog) and the tools' model names (prop:field_camera)
const TOOL_PROP = { camera: "field_camera", guide: "field_guide", lens: "hand_lens" };
if (byKey.keeper) expedition.keeper.modelUrl = byKey.keeper;
if (byKey["keeper:icon"]) expedition.keeper.portraitUrl = byKey["keeper:icon"];
if (byKey["prop:spark"]) expedition.models.spark = byKey["prop:spark"];
for (const tl of expedition.tools) {
  if (byKey["icon:" + tl.id]) tl.iconUrl = byKey["icon:" + tl.id];
  if (byKey["prop:" + TOOL_PROP[tl.id]]) tl.modelUrl = byKey["prop:" + TOOL_PROP[tl.id]];
}
for (const s of expedition.species) {
  const k = "species:" + s.id.replace(/-/g, "_");
  if (byKey[k]) s.modelUrl = byKey[k];
  if (byKey[k + ":icon"]) s.iconUrl = byKey[k + ":icon"];
  if (byKey[k + ":silhouette"]) s.silhouetteUrl = byKey[k + ":silhouette"];
}
// the Biome Frontier's arrival line now talks about photographing creatures (the card quiz is gone)
const bf2 = lang("ow-voice-biomeFrontier2");
const voicePatch = bf2.en && bf2.fr ? { biomeFrontier: bf2 } : null;
const remote = { quests, expedition, voice: voicePatch, bugGames, biomeFrontier };
fs.writeFileSync(path.join(here, "expedition.props.json"), JSON.stringify(remote, null, 1));

// local copy: library URLs -> /lib/<id>.<ext> when that file is in dev/public/lib (else kept)
const lib = new Set(fs.readdirSync(path.join(here, "public/lib")));
const localize = (v) => {
  if (typeof v === "string") {
    const m = v.match(/\/api\/files\/p\/([0-9a-f]{24})$/);
    if (m) for (const f of lib) if (f.startsWith(m[1] + ".")) return "/lib/" + f;
    return v;
  }
  if (Array.isArray(v)) return v.map(localize);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v)) o[k] = localize(v[k]);
    return o;
  }
  return v;
};
const localPath = path.join(here, "props.local.json");
const local = JSON.parse(fs.readFileSync(localPath, "utf8"));
local.quests = localize(quests);
local.expedition = localize(expedition);
local.bugGames = localize(bugGames);
local.biomeFrontier = { ...local.biomeFrontier, ...localize(biomeFrontier), models: { ...local.biomeFrontier.models, ...localize({ digBlock: biomeFrontier.models.digBlock }) }, textures: local.biomeFrontier.textures, sounds: local.biomeFrontier.sounds };
if (voicePatch) local.voice = { ...(local.voice || {}), ...localize(voicePatch) };
fs.writeFileSync(localPath, JSON.stringify(local));
const missing = [];
JSON.stringify(local.expedition, (k, v) => (typeof v === "string" && /^https?:/.test(v) && missing.push(v), v));
console.log("assets DONE:", done, "quests", quests.length, "species", expedition.species.length, "voice lines", expedition.keeper.lines.filter((l) => l.audio).length, "facts audio", expedition.species.filter((s) => s.factAudio).length, "remote-only URLs", missing.length);
