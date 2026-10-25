// Phase 3, "Together": the rules of the community garden, the BioBlitz, team-up finds, the museum and
// stickers, as pure functions over small records (the same rules run in the game and in tests), and the
// live state shared by the 3D scene and the DOM. Everything shared between players is ids and numbers.
import { create } from "zustand";
import type { CoopFind, GardenPlant, MuseumPhoto, TogetherProps, TogetherRules } from "../block";
import type { Game } from "./state";
import type { Row } from "./shared";

export const NICK = /^[A-Za-z]{2,14} [A-Za-z]{2,14} \d{2}$/;
const ID = /^[a-z0-9-]{1,24}$/;
export const KEEPER_NICK = "~keeper";
export const BEDS = 4;
export const SLOTS = 6;

// ------------------------------------------------------------------ the save (cloud-save key `together`)
export interface TSave {
  v: 1;
  /** My plantings: bed, slot, plant id, planted at (ms). */
  plots: [number, number, string, number][];
  /** My waterings: bed, slot, at (ms). */
  waters: [number, number, number][];
  badges: string[];
  /** BioBlitz: rounds taken part in, best team count; the event joined now (id, start, my finds). */
  bb: { n: number; best: number; ev: string; s: number; f: string[] };
  coop: string[];
  helped: number;
  /** Pollinator > plant visits I recorded ("bumblebee>lavender"). */
  pairs: string[];
  /** My museum display: species, behaviour, stars. */
  museum: [string, string, number][];
  /** Stickers I left: display owner (nickname), sticker id. */
  stk: [string, string][];
  /** Plants of mine that flowered (planted-at stamps), for the gardener badge. */
  bloomed: number;
}

export const EMPTY_T: TSave = { v: 1, plots: [], waters: [], badges: [], bb: { n: 0, best: 0, ev: "", s: 0, f: [] }, coop: [], helped: 0, pairs: [], museum: [], stk: [], bloomed: 0 };

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : NaN);
const ids = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && ID.test(x)).slice(0, max) : []);

/** A save from the cloud, made safe (and bounded: a few kilobytes at most). */
export function cleanT(x: unknown): TSave {
  const o = (x && typeof x === "object" ? x : {}) as Partial<TSave>;
  const plots = (Array.isArray(o.plots) ? o.plots : [])
    .filter((p) => Array.isArray(p) && isFinite(num(p[0])) && isFinite(num(p[1])) && typeof p[2] === "string" && ID.test(p[2]) && isFinite(num(p[3])))
    .slice(-6) as TSave["plots"];
  const waters = (Array.isArray(o.waters) ? o.waters : []).filter((w) => Array.isArray(w) && w.every((n) => isFinite(num(n)))).slice(-12) as TSave["waters"];
  const bb = o.bb && typeof o.bb === "object" ? o.bb : EMPTY_T.bb;
  const museum = (Array.isArray(o.museum) ? o.museum : [])
    .filter((m) => Array.isArray(m) && ID.test(String(m[0])) && ID.test(String(m[1])) && isFinite(num(m[2])))
    .slice(0, 6) as TSave["museum"];
  const stk = (Array.isArray(o.stk) ? o.stk : []).filter((s) => Array.isArray(s) && (NICK.test(String(s[0])) || s[0] === KEEPER_NICK) && ID.test(String(s[1]))).slice(-30) as TSave["stk"];
  return {
    v: 1,
    plots,
    waters,
    badges: ids(o.badges, 12),
    bb: { n: Math.max(0, num(bb.n) || 0), best: Math.max(0, num(bb.best) || 0), ev: typeof bb.ev === "string" && ID.test(bb.ev) ? bb.ev : "", s: num(bb.s) || 0, f: ids(bb.f, 60) },
    coop: ids(o.coop, 12),
    helped: Math.max(0, num(o.helped) || 0),
    pairs: (Array.isArray(o.pairs) ? o.pairs : []).filter((p): p is string => typeof p === "string" && /^[a-z0-9-]{1,24}>[a-z0-9-]{1,24}$/.test(p)).slice(0, 40),
    museum,
    stk,
    bloomed: Math.max(0, num(o.bloomed) || 0),
  };
}

// ------------------------------------------------------------------ the garden
export interface Plot {
  bed: number;
  slot: number;
  plant: string;
  at: number;
  by: string;
  mine: boolean;
  keeper: boolean;
  waters: number;
  /** 0 sprout, 1 young, 2 flowering */
  stage: number;
}

/** Growth: sprout at once, young after `youngMin`, flowering after `flowerMin`; each watering (any explorer, up to `waterMax`) saves `waterMin`. */
export function stageOf(at: number, waters: number, now: number, r: TogetherRules): number {
  const min = (now - at) / 60000 + Math.min(waters, r.waterMax) * r.waterMin;
  return min >= r.flowerMin ? 2 : min >= r.youngMin ? 1 : 0;
}

/** Minutes until the next stage (0 when flowering). */
export function minutesToNext(p: Plot, now: number, r: TogetherRules): number {
  if (p.stage >= 2 || p.keeper) return 0;
  const min = (now - p.at) / 60000 + Math.min(p.waters, r.waterMax) * r.waterMin;
  return Math.max(1, Math.ceil((p.stage === 0 ? r.youngMin : r.flowerMin) - min));
}

export interface GardenData {
  p: [number, number, string, number][];
  w: [number, number, number][];
}

/** Everyone's plantings in my room's age tile, merged: the first to plant a spot keeps it; waterings add up. */
export function gardenView(rows: Row[], tile: string, mine: TSave, myNick: string, tp: TogetherProps, now: number): Plot[] {
  const r = tp.rules;
  const plantIds = new Set(tp.plants.map((p) => p.id));
  const life = r.lifeHours * 3600000;
  const valid = (bed: number, slot: number, plant: string, at: number) =>
    Number.isInteger(bed) && bed >= 1 && bed < BEDS && Number.isInteger(slot) && slot >= 0 && slot < SLOTS && plantIds.has(plant) && at <= now + 60000 && now - at < life;
  const best = new Map<string, Plot>();
  const add = (bed: number, slot: number, plant: string, at: number, by: string, isMine: boolean) => {
    if (!valid(bed, slot, plant, at)) return;
    const k = bed + ":" + slot;
    const cur = best.get(k);
    if (!cur || at < cur.at) best.set(k, { bed, slot, plant, at, by, mine: isMine, keeper: false, waters: 0, stage: 0 });
  };
  const waters: [number, number, number][] = mine.waters.slice();
  const others = rows.filter((x) => !x.mine && tile && (x.data as { tile?: string }).tile === tile && NICK.test(x.nickname));
  for (const x of others) {
    const d = x.data as unknown as GardenData;
    for (const p of (Array.isArray(d.p) ? d.p : []).slice(0, 6)) if (Array.isArray(p)) add(num(p[0]), num(p[1]), String(p[2]), num(p[3]), x.nickname, false);
    for (const w of (Array.isArray(d.w) ? d.w : []).slice(0, 12)) if (Array.isArray(w) && w.every((n) => isFinite(num(n)))) waters.push([num(w[0]), num(w[1]), num(w[2])]);
  }
  for (const p of mine.plots) add(p[0], p[1], p[2], p[3], myNick, true);
  const out: Plot[] = [];
  // the Keeper's bed: always in flower, so the first pollinators come even to an empty garden
  tp.keeperBed.slice(0, SLOTS).forEach((plant, slot) => {
    if (plantIds.has(plant)) out.push({ bed: 0, slot, plant, at: 0, by: KEEPER_NICK, mine: false, keeper: true, waters: 0, stage: 2 });
  });
  best.forEach((p) => {
    p.waters = waters.filter((w) => w[0] === p.bed && w[1] === p.slot && w[2] > p.at).length;
    p.stage = stageOf(p.at, p.waters, now, r);
    out.push(p);
  });
  return out;
}

/** Plant (my row keeps at most `plantsEach` plants: a new one replaces my oldest). Null if the spot is taken. */
export function plantIn(s: TSave, plots: Plot[], bed: number, slot: number, plant: string, now: number, r: TogetherRules): TSave | null {
  if (bed < 1 || plots.some((p) => p.bed === bed && p.slot === slot)) return null;
  const life = r.lifeHours * 3600000;
  let mineNow = s.plots.filter((p) => now - p[3] < life);
  if (mineNow.length >= r.plantsEach) mineNow = mineNow.slice(mineNow.length - r.plantsEach + 1);
  return { ...s, plots: mineNow.concat([[bed, slot, plant, now]]) };
}

/** Water a plant: once every 10 minutes per explorer and plant. */
export const WATER_EVERY = 10 * 60000;
export function canWater(s: TSave, bed: number, slot: number, now: number): boolean {
  return !s.waters.some((w) => w[0] === bed && w[1] === slot && now - w[2] < WATER_EVERY);
}
export function waterAt(s: TSave, bed: number, slot: number, now: number): TSave {
  return { ...s, waters: s.waters.concat([[bed, slot, now]]).slice(-12) };
}

/** Which pollinators come, and to which flowering plants (a plant's `visitors` are the real pairings). */
export function pollinatorsFor(plots: Plot[], plants: GardenPlant[]): Record<string, Plot[]> {
  const by: Record<string, GardenPlant> = {};
  for (const p of plants) by[p.id] = p;
  const out: Record<string, Plot[]> = {};
  for (const p of plots) {
    if (p.stage < 2 || !by[p.plant]) continue;
    for (const v of by[p.plant].visitors) (out[v] = out[v] || []).push(p);
  }
  return out;
}

// ------------------------------------------------------------------ the BioBlitz
export interface Blitz {
  id: string;
  start: number;
  found: string[];
  team: string[];
}

export function blitzEnd(b: Blitz, r: TogetherRules): number {
  return b.start + r.blitzMinutes * 60000;
}

export function newBlitzId(now: number): string {
  return "bb-" + now.toString(36) + Math.random().toString(36).slice(2, 5);
}

/** Two views of the same event merge (finds and teams add up); of two different events, the earlier one is the room's. */
export function mergeBlitz(a: Blitz | null, b: Blitz | null): Blitz | null {
  if (!a) return b;
  if (!b) return a;
  if (a.id === b.id) {
    const found = a.found.slice();
    for (const f of b.found) if (found.indexOf(f) < 0) found.push(f);
    const team = a.team.slice();
    for (const n of b.team) if (team.indexOf(n) < 0) team.push(n);
    return { id: a.id, start: Math.min(a.start, b.start), found: found.slice(0, 60), team: team.slice(0, 40) };
  }
  return a.start < b.start || (a.start === b.start && a.id < b.id) ? a : b;
}

/** The room's live BioBlitz from the shared rows of my tile (and my own view). */
export function blitzFromRows(rows: Row[], tile: string, now: number, r: TogetherRules): Blitz | null {
  let out: Blitz | null = null;
  for (const x of rows) {
    const d = x.data as { tile?: string; i?: string; s?: number; f?: unknown };
    if (x.mine || !tile || d.tile !== tile || typeof d.i !== "string" || !ID.test(d.i) || !NICK.test(x.nickname)) continue;
    const s = num(d.s);
    if (!isFinite(s) || s > now + 60000 || now >= s + r.blitzMinutes * 60000) continue;
    out = mergeBlitz(out, { id: d.i, start: s, found: ids(d.f, 60), team: [x.nickname] });
  }
  return out;
}

// ------------------------------------------------------------------ the museum
export interface Display {
  owner: string;
  mine: boolean;
  keeper: boolean;
  photos: MuseumPhoto[];
}

export function displaysFrom(rows: Row[], tile: string, mine: TSave, myNick: string, keeperPhotos: MuseumPhoto[], speciesIds: Set<string>, max: number): Display[] {
  const clean = (ph: unknown): MuseumPhoto[] =>
    (Array.isArray(ph) ? ph : [])
      .filter((m) => Array.isArray(m) && speciesIds.has(String(m[0])) && ID.test(String(m[1])))
      .slice(0, 4)
      .map((m) => ({ species: String(m[0]), behaviour: String(m[1]), stars: Math.max(1, Math.min(3, Math.round(num(m[2]) || 1))) }));
  const out: Display[] = [{ owner: myNick, mine: true, keeper: false, photos: clean(mine.museum) }];
  const others = rows
    .filter((x) => !x.mine && tile && (x.data as { tile?: string }).tile === tile && NICK.test(x.nickname) && x.nickname !== myNick)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  for (const x of others) {
    if (out.length >= max) break;
    const photos = clean((x.data as { ph?: unknown }).ph);
    if (photos.length && !out.some((d) => d.owner === x.nickname)) out.push({ owner: x.nickname, mine: false, keeper: false, photos });
  }
  return [{ owner: KEEPER_NICK, mine: false, keeper: true, photos: keeperPhotos.filter((p) => speciesIds.has(p.species)).slice(0, 4) }, ...out];
}

/** Sticker counts per display owner, from every visitor's row of my tile (and mine). */
export function stickerCounts(rows: Row[], tile: string, mine: TSave, stickerIds: Set<string>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  const add = (owner: string, st: string) => {
    if (!(NICK.test(owner) || owner === KEEPER_NICK) || !stickerIds.has(st)) return;
    const o = (out[owner] = out[owner] || {});
    o[st] = (o[st] || 0) + 1;
  };
  for (const x of rows) {
    if (x.mine || !tile || (x.data as { tile?: string }).tile !== tile || !NICK.test(x.nickname)) continue;
    const g = (x.data as { g?: unknown }).g;
    for (const e of (Array.isArray(g) ? g : []).slice(0, 30)) if (Array.isArray(e) && e[0] !== x.nickname) add(String(e[0]), String(e[1]));
  }
  for (const e of mine.stk) add(e[0], e[1]);
  return out;
}

/** Leave a sticker on a display (one per display: a new one replaces mine there). */
export function giveSticker(s: TSave, owner: string, sticker: string): TSave {
  return { ...s, stk: s.stk.filter((e) => e[0] !== owner).concat([[owner, sticker]]).slice(-30) };
}

// ------------------------------------------------------------------ team-up finds
/** Someone holds the right tool out for this find close to the creature (another explorer, or the Keeper's helper). */
export function holderNear(game: Game, c: CoopFind, x: number, z: number, helper: Helper | null, r = 7): string | null {
  const now = performance.now();
  let who: string | null = null;
  game.peers.forEach((p) => {
    if (who || game.hidden.has(p.id)) return;
    if (p.hold === c.hold && p.holdC === c.id && now - p.seen < 4000 && Math.hypot(p.x - x, p.z - z) <= r) who = p.nick;
  });
  if (who) return who;
  if (helper && helper.coop === c.id && Math.hypot(helper.x - x, helper.z - z) <= r) return "";
  return null;
}

export interface Helper {
  coop: string;
  x: number;
  z: number;
  ry: number;
  at: number;
}

// ------------------------------------------------------------------ live state
export type TCard =
  | { kind: "bed"; bed: number }
  | { kind: "display"; owner: string }
  | { kind: "blitz" }
  | { kind: "blitzResult"; count: number; goal: number; met: boolean }
  | { kind: "coop"; id: string; by: string; holder: boolean }
  | { kind: "badge"; id: string };

export interface TState {
  loaded: boolean;
  save: TSave;
  /** My EdVerse age tile ("" = no age known: alone). */
  tile: string;
  plots: Plot[];
  displays: Display[];
  stickers: Record<string, Record<string, number>>;
  blitz: Blitz | null;
  card: TCard | null;
  /** Reward cards waiting their turn (a badge after the find's own card). */
  cardQueue: TCard[];
  /** A team-up find is close (its id), and since when no partner was there (ms). */
  coopNear: string | null;
  helper: Helper | null;
  /** A creature someone is showing me: it glows for a while. */
  beacon: { species: string; until: number; by: string } | null;
  /** Where each garden pollinator is feeding now (creature key -> plot "bed:slot"). */
  feeding: Record<string, string>;
  setSave: (s: TSave) => void;
}

export const useTogether = create<TState>((set) => ({
  loaded: false,
  save: EMPTY_T,
  tile: "",
  plots: [],
  displays: [],
  stickers: {},
  blitz: null,
  card: null,
  cardQueue: [],
  coopNear: null,
  helper: null,
  beacon: null,
  feeding: {},
  setSave: (s) => set({ save: s }),
}));

/** Shows a reward card now, or after the one already open. */
export function queueCard(c: TCard) {
  const st = useTogether.getState();
  if (st.card) useTogether.setState({ cardQueue: st.cardQueue.concat(c).slice(-4) });
  else useTogether.setState({ card: c });
}
/** Closes the open card (the next waiting one shows). */
export function closeCard() {
  const q = useTogether.getState().cardQueue;
  useTogether.setState({ card: q[0] || null, cardQueue: q.slice(1) });
}

export const PLANT_STAGES = ["sprout", "young", "flowering"] as const;
