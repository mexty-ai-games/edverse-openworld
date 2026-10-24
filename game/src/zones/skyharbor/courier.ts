// Robot Courier: the grid, the program (blocks with repeat loops) and the robot's run, as plain logic.
// The overlay (Activity.tsx) draws it; everything here is deterministic so it can be checked by script.
import type { CourierLevel } from "./types";

export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

/** F forward · L turn left · R turn right · U/D/W/E move one cell up/down/left/right (arrows mode). */
export type Op = "F" | "L" | "R" | "U" | "D" | "W" | "E";
export interface Simple {
  op: Op;
}
export interface Repeat {
  op: "REP";
  n: number;
  body: Simple[];
}
export type Block = Simple | Repeat;

export interface Grid {
  w: number;
  h: number;
  cells: string[][];
  start: { x: number; y: number; dir: Dir };
  part: { x: number; y: number };
  goal: { x: number; y: number };
}

export function dirOf(s: string): Dir {
  const i = "NESW".indexOf((s || "E").toUpperCase());
  return (i < 0 ? 1 : i) as Dir;
}

export function parseLevel(l: CourierLevel): Grid {
  const rows = l.rows.length ? l.rows : ["S.P.G"];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cells: string[][] = [];
  let start = { x: 0, y: 0, dir: dirOf(l.facing) };
  let part = { x: -1, y: -1 };
  let goal = { x: w - 1, y: h - 1 };
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] || ".";
      if (c === "S") start = { x, y, dir: start.dir };
      if (c === "P") part = { x, y };
      if (c === "G") goal = { x, y };
      row.push(c === "#" ? "#" : c === "P" || c === "G" ? c : ".");
    }
    cells.push(row);
  }
  return { w, h, cells, start, part, goal };
}

/** Blocks the program uses (a repeat counts 1, plus each block inside it). */
export function countBlocks(p: Block[]): number {
  return p.reduce((n, b) => n + (b.op === "REP" ? 1 + (b as Repeat).body.length : 1), 0);
}

/** One step of the run, pointing back at the block that made it (top index, inner index or -1). */
export interface Step {
  op: Op;
  top: number;
  inner: number;
  pass: number;
}

export function flatten(p: Block[]): Step[] {
  const out: Step[] = [];
  p.forEach((b, i) => {
    if (b.op === "REP") {
      const r = b as Repeat;
      for (let k = 0; k < r.n; k++) r.body.forEach((s, j) => out.push({ op: s.op, top: i, inner: j, pass: k }));
    } else out.push({ op: b.op as Op, top: i, inner: -1, pass: 0 });
  });
  return out;
}

export interface Frame {
  x: number;
  y: number;
  dir: Dir;
  carrying: boolean;
  /** Index of the step just done (-1 = start). */
  step: number;
  event: "" | "move" | "turn" | "pick" | "bump" | "edge" | "deliver";
}

export interface RunResult {
  frames: Frame[];
  steps: Step[];
  outcome: "delivered" | "bump" | "edge" | "nopart" | "notthere" | "empty";
  /** The step that went wrong (bump / edge), else -1. */
  badStep: number;
  /** The cell the robot bumped into (bump / edge). */
  bumpCell: { x: number; y: number } | null;
}

/** Runs the program on the grid, frame by frame. The robot stops at the first bump or on delivery. */
export function run(g: Grid, p: Block[]): RunResult {
  const steps = flatten(p);
  let s: Frame = { x: g.start.x, y: g.start.y, dir: g.start.dir, carrying: false, step: -1, event: "" };
  const frames: Frame[] = [s];
  if (!steps.length) return { frames, steps, outcome: "empty", badStep: -1, bumpCell: null };
  const LIMIT = 400;
  for (let i = 0; i < steps.length && i < LIMIT; i++) {
    const op = steps[i].op;
    let dir = s.dir;
    if (op === "L") {
      s = { ...s, dir: ((s.dir + 3) % 4) as Dir, step: i, event: "turn" };
      frames.push(s);
      continue;
    }
    if (op === "R") {
      s = { ...s, dir: ((s.dir + 1) % 4) as Dir, step: i, event: "turn" };
      frames.push(s);
      continue;
    }
    if (op === "U") dir = 0;
    else if (op === "E") dir = 1;
    else if (op === "D") dir = 2;
    else if (op === "W") dir = 3;
    const nx = s.x + DX[dir];
    const ny = s.y + DY[dir];
    if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) {
      frames.push({ ...s, dir, step: i, event: "edge" });
      return { frames, steps, outcome: "edge", badStep: i, bumpCell: { x: nx, y: ny } };
    }
    if (g.cells[ny][nx] === "#") {
      frames.push({ ...s, dir, step: i, event: "bump" });
      return { frames, steps, outcome: "bump", badStep: i, bumpCell: { x: nx, y: ny } };
    }
    let carrying = s.carrying;
    let event: Frame["event"] = "move";
    if (!carrying && nx === g.part.x && ny === g.part.y) {
      carrying = true;
      event = "pick";
    }
    if (carrying && nx === g.goal.x && ny === g.goal.y) {
      s = { x: nx, y: ny, dir, carrying, step: i, event: "deliver" };
      frames.push(s);
      return { frames, steps, outcome: "delivered", badStep: -1, bumpCell: null };
    }
    s = { x: nx, y: ny, dir, carrying, step: i, event };
    frames.push(s);
  }
  return { frames, steps, outcome: s.carrying ? "notthere" : "nopart", badStep: -1, bumpCell: null };
}

/**
 * The fewest blocks that deliver the part: a breadth-first search over (cell, facing, carrying).
 * Code blocks: forward / left / right each cost one block. Arrows: one arrow per cell.
 */
function shortest(g: Grid, simple: boolean): Op[] | null {
  const key = (x: number, y: number, d: number, c: number) => ((y * g.w + x) * 4 + d) * 2 + c;
  const start = { x: g.start.x, y: g.start.y, d: g.start.dir as number, c: 0 };
  const prev = new Map<number, { k: number; op: Op }>();
  const k0 = key(start.x, start.y, start.d, 0);
  prev.set(k0, { k: -1, op: "F" });
  const q = [start];
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.cells[y][x] !== "#";
  while (q.length) {
    const s = q.shift()!;
    const ks = key(s.x, s.y, s.d, s.c);
    const moves: { x: number; y: number; d: number; op: Op }[] = [];
    if (simple) {
      (["U", "E", "D", "W"] as Op[]).forEach((op, d) => moves.push({ x: s.x + DX[d], y: s.y + DY[d], d, op }));
    } else {
      moves.push({ x: s.x + DX[s.d], y: s.y + DY[s.d], d: s.d, op: "F" });
      moves.push({ x: s.x, y: s.y, d: (s.d + 3) % 4, op: "L" });
      moves.push({ x: s.x, y: s.y, d: (s.d + 1) % 4, op: "R" });
    }
    for (const m of moves) {
      if (!free(m.x, m.y)) continue;
      const c = s.c || (m.x === g.part.x && m.y === g.part.y) ? 1 : 0;
      const k = key(m.x, m.y, m.d, c);
      if (prev.has(k)) continue;
      prev.set(k, { k: ks, op: m.op });
      if (c && m.x === g.goal.x && m.y === g.goal.y) {
        const ops: Op[] = [];
        let cur = k;
        while (cur !== k0) {
          const p = prev.get(cur)!;
          ops.unshift(p.op);
          cur = p.k;
        }
        return ops;
      }
      q.push({ x: m.x, y: m.y, d: m.d, c });
    }
  }
  return null;
}

/** A working program for the level (the "show me" help): arrows, or blocks with repeats when it helps. */
export function solve(g: Grid, simple: boolean, loops: boolean): Block[] {
  const ops = shortest(g, simple);
  if (!ops) return [];
  if (!loops) return ops.map((op) => ({ op }));
  // the most compact of: runs of the same block, or the best repeating pattern (+ runs around it)
  const cands: Block[][] = [runs(ops)];
  for (let len = 2; len <= 4; len++)
    for (let at = 0; at + len * 2 <= ops.length; at++) {
      const body = ops.slice(at, at + len);
      let n = 1;
      while (at + len * (n + 1) <= ops.length && ops.slice(at + len * n, at + len * (n + 1)).join() === body.join()) n++;
      if (n < 2) continue;
      const head = runs(ops.slice(0, at));
      const rest = ops.slice(at + len * n);
      const rep = (k: number): Block => ({ op: "REP", n: k, body: body.map((op) => ({ op })) });
      cands.push(head.concat([rep(n)], runs(rest)));
      // the robot stops on delivery, so a pattern can run one more time when the rest is its beginning
      if (rest.length && rest.length < len && rest.join() === body.slice(0, rest.length).join()) cands.push(head.concat([rep(n + 1)]));
    }
  return cands.reduce((a, b) => (countBlocks(b) < countBlocks(a) ? b : a));
}

function runs(ops: Op[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < ops.length; ) {
    let j = i;
    while (j < ops.length && ops[j] === ops[i]) j++;
    const n = j - i;
    if (n >= 3) out.push({ op: "REP", n, body: [{ op: ops[i] }] });
    else for (let k = 0; k < n; k++) out.push({ op: ops[i] });
    i = j;
  }
  return out;
}
