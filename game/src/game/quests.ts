// The quest engine: data-driven quests (props `quests[]`) run one after another. Pure functions over a
// small save record (one cloud-save key), so the same rules run in the game and in tests.
import type { Quest, QuestStep } from "../block";

/** A photo is a record, never an image: the Field Guide redraws it. */
export interface PhotoRecord {
  speciesId: string;
  /** idle | move | feed | special */
  behaviour: string;
  /** 1-3 */
  stars: number;
  /** ms since 1970 */
  at: number;
}

/** Field Guide page progress: stage bits 1 seen · 2 photographed · 4 identified · 8 behaviour observed. */
export interface GuidePage {
  st: number;
  ph?: PhotoRecord;
}

export interface ExpSave {
  v: 1;
  /** The keeper has greeted this explorer (the first quest has started). */
  started: boolean;
  /** Current quest index (quests.length = all done) and step index. */
  q: number;
  s: number;
  /** What already matched the current step (spark ids, species ids...). */
  p: string[];
  tools: string[];
  /** Field Guide pages by species id. */
  g: Record<string, GuidePage>;
  /** The learning record's complete() was sent. */
  reported: boolean;
}

export const EMPTY_EXP: ExpSave = { v: 1, started: false, q: 0, s: 0, p: [], tools: [], g: {}, reported: false };

export const STAGE = { seen: 1, photo: 2, id: 4, behaviour: 8 } as const;
export const STAGES = [STAGE.seen, STAGE.photo, STAGE.id, STAGE.behaviour];

export type QuestEventKind = "talk" | "find" | "tool" | "visit" | "photo" | "identify" | "observe";

export interface QuestEvent {
  kind: QuestEventKind;
  /** The thing: "keeper", a spark id, a tool id, a zone id, a species id. */
  id: string;
  /** The zone it happened in. */
  zone: string;
}

/** A save from the cloud, made safe (old or broken records start fresh where needed). */
export function cleanSave(x: unknown): ExpSave {
  const o = (x && typeof x === "object" ? x : {}) as Partial<ExpSave>;
  const g: Record<string, GuidePage> = {};
  if (o.g && typeof o.g === "object")
    for (const k of Object.keys(o.g)) {
      const pg = (o.g as Record<string, GuidePage>)[k];
      if (pg && typeof pg.st === "number") g[k] = { st: pg.st & 15, ph: pg.ph && typeof pg.ph.stars === "number" ? pg.ph : undefined };
    }
  return {
    v: 1,
    started: !!o.started,
    q: Math.max(0, Number(o.q) || 0),
    s: Math.max(0, Number(o.s) || 0),
    p: Array.isArray(o.p) ? o.p.map(String).slice(0, 20) : [],
    tools: Array.isArray(o.tools) ? o.tools.map(String) : [],
    g,
    reported: !!o.reported,
  };
}

export function currentQuest(quests: Quest[], s: ExpSave): Quest | null {
  return s.started && s.q < quests.length ? quests[s.q] : null;
}

export function currentStep(quests: Quest[], s: ExpSave): QuestStep | null {
  const q = currentQuest(quests, s);
  return q ? q.steps[Math.min(s.s, q.steps.length - 1)] || null : null;
}

function addTools(have: string[], add: string[]): { tools: string[]; given: string[] } {
  const tools = have.slice();
  const given: string[] = [];
  for (const t of add || []) if (tools.indexOf(t) < 0) {
    tools.push(t);
    given.push(t);
  }
  return { tools, given };
}

export interface Outcome {
  save: ExpSave;
  /** Something new matched the current step. */
  progressed: boolean;
  /** The step(s) that just finished. */
  stepsDone: QuestStep[];
  /** The quest that just finished (its `done` dialogue plays), and the one that just started (`intro`). */
  questDone: Quest | null;
  questStarted: Quest | null;
  /** Tools given by this event (rewards and the next quest's giveAtStart). */
  given: string[];
  /** The last quest just finished. */
  allDone: boolean;
}

function blank(save: ExpSave): Outcome {
  return { save, progressed: false, stepsDone: [], questDone: null, questStarted: null, given: [], allDone: false };
}

function matches(step: QuestStep, ev: QuestEvent): boolean {
  if (step.kind !== ev.kind) return false;
  // a target matches its own id or a family of ids ("spark" matches "spark-tree")
  if (step.target && step.target !== "any" && step.target !== ev.id && ev.id.indexOf(step.target + "-") !== 0) return false;
  if (step.zone && step.zone !== ev.zone) return false;
  return true;
}

/** Steps already true when they begin (own a tool) finish at once. */
function settle(quests: Quest[], out: Outcome, zone: string) {
  for (let guard = 0; guard < 20; guard++) {
    const st = currentStep(quests, out.save);
    if (!st) return;
    const already = (st.kind === "tool" && out.save.tools.indexOf(st.target) >= 0) || (st.kind === "visit" && st.target === zone);
    if (!already) return;
    advance(quests, out, zone);
  }
}

function advance(quests: Quest[], out: Outcome, zone: string) {
  const q = currentQuest(quests, out.save);
  if (!q) return;
  const step = q.steps[out.save.s];
  if (step) out.stepsDone.push(step);
  let s: ExpSave = { ...out.save, s: out.save.s + 1, p: [] };
  if (s.s >= q.steps.length) {
    const r = addTools(s.tools, q.reward);
    out.given.push(...r.given);
    s = { ...s, tools: r.tools, q: s.q + 1, s: 0 };
    out.questDone = q;
    if (s.q >= quests.length) out.allDone = true;
    else {
      const nq = quests[s.q];
      const g = addTools(s.tools, nq.giveAtStart);
      out.given.push(...g.given);
      s = { ...s, tools: g.tools };
      out.questStarted = nq;
    }
  }
  out.save = s;
  settle(quests, out, zone);
}

/** The first quest begins (the keeper's greeting). */
export function startExpedition(quests: Quest[], save: ExpSave, zone: string): Outcome {
  const out = blank({ ...save, started: true, q: 0, s: 0, p: [] });
  const q = quests[0];
  if (!q) return out;
  const g = addTools(out.save.tools, q.giveAtStart);
  out.save = { ...out.save, tools: g.tools };
  out.given = g.given;
  out.questStarted = q;
  settle(quests, out, zone);
  return out;
}

/** Something happened in the world: does it move the current quest on? */
export function applyEvent(quests: Quest[], save: ExpSave, ev: QuestEvent): Outcome {
  const out = blank(save);
  const step = currentStep(quests, save);
  if (!step || !matches(step, ev)) return out;
  if (save.p.indexOf(ev.id) >= 0) return out;
  out.progressed = true;
  out.save = { ...save, p: save.p.concat(ev.id) };
  if (out.save.p.length >= Math.max(1, step.count || 1)) advance(quests, out, ev.zone);
  return out;
}

/** Field Guide stages filled (the learning record's score). */
export function guideScore(save: ExpSave): number {
  let n = 0;
  for (const k of Object.keys(save.g)) for (const b of STAGES) if (save.g[k].st & b) n++;
  return n;
}

/** Photo score: 1 star in frame; +1 well framed (in the ring, a good share of the frame, close enough); +1 doing something. */
export interface PhotoCheck {
  /** Distance of the creature's centre from the frame centre, 0 (centre) .. 1 (edge of the short side). */
  offCentre: number;
  /** Share of the frame's height its body fills (0..1+). */
  fill: number;
  /** Metres from the explorer. */
  distance: number;
  behaviour: string;
}

export const PHOTO_RULES = { ring: 0.36, minFill: 0.1, maxFill: 0.85, inFrameFill: 0.025, maxDistance: 11 };

export function photoStars(c: PhotoCheck): { stars: number; framed: boolean; acting: boolean; tip: "centre" | "closer" | "fill" | "behaviour" | "" } {
  const centred = c.offCentre <= PHOTO_RULES.ring;
  const filled = c.fill >= PHOTO_RULES.minFill && c.fill <= PHOTO_RULES.maxFill;
  const close = c.distance <= PHOTO_RULES.maxDistance;
  const framed = centred && filled && close;
  const acting = c.behaviour === "feed" || c.behaviour === "special";
  const stars = 1 + (framed ? 1 : 0) + (acting ? 1 : 0);
  const tip = !centred ? "centre" : !close || c.fill < PHOTO_RULES.minFill ? "closer" : !filled ? "fill" : !acting ? "behaviour" : "";
  return { stars, framed, acting, tip };
}
