// Where everything stands in the Idea Grove (metres, Y up; the camera looks north, toward -Z).
// Models are props; this is the structure that places them, and the solid shapes the explorer walks around.

export const PLAZA_R = 7.0;
export const PLAZA_TOP = 0.22;
export const WORLD_R = 19.5;
export const TREE = { x: 0, z: -11.5, ry: 0.4, scale: 1.0 };
export const SPAWN = { x: 0, y: PLAZA_TOP, z: 4.2, ry: Math.PI };

export interface StallSpot {
  key: "biome" | "chrono" | "sky";
  district: string;
  x: number;
  z: number;
  ry: number;
}

function facing(x: number, z: number) {
  // the stall's front (+Z of the model) turned toward the plaza centre
  return Math.atan2(-x, -z);
}

export const STALLS: StallSpot[] = [
  { key: "biome", district: "biome-frontier", x: -11.2, z: -2.2, ry: facing(-11.2, -2.2) },
  { key: "chrono", district: "chrono-quarter", x: 11.2, z: -2.2, ry: facing(11.2, -2.2) },
  { key: "sky", district: "skyharbor", x: 9.6, z: 8.8, ry: facing(9.6, 8.8) },
];

export const TELESCOPE = { x: -4.4, z: 3.4, ry: 2.3 };

/** The Grove Keeper stands by the Idea Tree, facing the explorer's arrival point. */
export const KEEPER = { x: 2.7, z: -5.4, ry: Math.atan2(0 - 2.7, 4.2 + 5.4) };

/** The three glowing seeds of "Three sparks": one in view, one beside the tree, one behind the start view. */
export const SPARKS = [
  { id: "spark-tree", x: -6.4, z: -6.6 },
  { id: "spark-east", x: 7.6, z: -9.2 },
  { id: "spark-behind", x: -3.2, z: 14.4 },
];

/** Where the tree frog sits on the Biome Frontier stall (stall-local x, height, z). */
export const FROG_CAMEO = { lx: 0.55, y: 1.02, lz: 0.75 };

export interface Placed {
  variant: number;
  x: number;
  z: number;
  s: number;
  ry: number;
}

/** Where the meadow insects live (south-east of the plaza, away from the paths): lavender for the honeybee, milkweed for the monarch caterpillar. */
export const MEADOW = {
  lavender: [
    { x: 7.6, z: 16.6, s: 1.7, ry: 0.3 },
    { x: 8.9, z: 15.7, s: 1.5, ry: 1.9 },
    { x: 8.8, z: 17.5, s: 1.45, ry: 4.0 },
    { x: 7.0, z: 17.9, s: 1.3, ry: 2.6 },
    { x: 10.1, z: 16.8, s: 1.35, ry: 5.1 },
  ],
  milkweed: [
    { x: 12.0, z: 12.4, s: 1.5, ry: 0.5 },
    { x: 12.9, z: 13.3, s: 1.35, ry: 2.2 },
    { x: 11.2, z: 13.5, s: 1.3, ry: 4.1 },
    { x: 13.3, z: 12.0, s: 1.2, ry: 1.2 },
  ],
};

/** The Bug Games arena in the west meadow, between the Biome Frontier stall and the south path (pieces face the plaza, east). */
export interface ArenaPiece {
  key: "grandstand" | "long_jump" | "weight_pull" | "race_lane" | "hide_board" | "night_box" | "podium" | "scoreboard" | "dance";
  x: number;
  z: number;
  ry: number;
  /** Collision circles (piece-local x, z, r). */
  solid: [number, number, number][];
}
export const ARENA = { x: -12.0, z: 8.6, rx: 5.2, rz: 6.6 };
const EAST = Math.PI / 2;
export const ARENA_PIECES: ArenaPiece[] = [
  { key: "grandstand", x: -16.7, z: 8.6, ry: EAST, solid: [[-1.4, 0, 0.9], [0, 0, 0.9], [1.4, 0, 0.9]] },
  { key: "long_jump", x: -14.3, z: 8.6, ry: 0, solid: [] },
  { key: "weight_pull", x: -12.2, z: 8.6, ry: 0, solid: [] },
  { key: "race_lane", x: -10.1, z: 8.6, ry: 0, solid: [] },
  { key: "hide_board", x: -14.6, z: 13.6, ry: EAST - 0.35, solid: [[-0.7, 0, 0.35], [0.7, 0, 0.35]] },
  { key: "night_box", x: -11.4, z: 13.9, ry: EAST - 0.15, solid: [[0, 0, 0.6]] },
  { key: "scoreboard", x: -13.2, z: 3.4, ry: EAST - 0.45, solid: [[-1.0, 0, 0.25], [1.0, 0, 0.25]] },
  { key: "podium", x: -10.0, z: 3.9, ry: EAST - 0.25, solid: [[0, 0, 0.9]] },
  { key: "dance", x: -8.6, z: 12.4, ry: EAST, solid: [] },
];
/** Where the explorer stands to watch an event (east of the tracks, facing the arena). */
export const ARENA_WATCH = { x: -7.4, z: 8.6 };

// ------------------------------------------------------------------ phase 3: together
/** A placed piece: position, facing (radians about Y) and scale. */
export interface Spot3 {
  x: number;
  z: number;
  ry: number;
  s: number;
}

/** The community garden, north-east of the Idea Tree: bed 0 is the Keeper's (always in flower), beds 1-3 are everyone's. */
export const GARDEN_BEDS: Spot3[] = [
  { x: 9.0, z: -10.6, ry: facing(9.0, -10.6), s: 1.15 },
  { x: 11.9, z: -9.0, ry: facing(11.9, -9.0), s: 1.15 },
  { x: 12.4, z: -12.3, ry: facing(12.4, -12.3), s: 1.15 },
  { x: 9.6, z: -13.9, ry: facing(9.6, -13.9), s: 1.15 },
];
/** The garden's seed stand (packets on a plinth) and the watering can beside it. */
export const SEED_STAND = { x: 7.6, z: -12.6, ry: facing(7.6, -12.6) };
export const GARDEN_CENTRE = { x: 10.7, z: -11.4 };

/** The Explorers' Museum, north-west of the Idea Tree, its doorway facing the plaza. */
export const MUSEUM = { x: -11.7, z: -11.2, ry: facing(-11.7, -11.2), s: 0.72 };

/** The BioBlitz banner and its progress totem, at the plaza's north-east edge. */
export const BLITZ_BANNER = { x: 6.4, z: -5.4, ry: facing(6.4, -5.4) };
export const BLITZ_TOTEM = { x: 4.3, z: -4.5, ry: facing(4.3, -4.5) };

/** Ground cover keeps off the museum's floor, the garden beds and the BioBlitz pieces. */
export function keepClear(x: number, z: number, pad = 0): boolean {
  if (Math.abs(x - MUSEUM.x) < 7 && Math.abs(z - MUSEUM.z) < 7) {
    const m = museumLocal(x, z);
    if (Math.abs(m.lx) < 6.4 + pad / MUSEUM.s && m.lz > -4.4 - pad / MUSEUM.s && m.lz < 4.6) return true;
    if (m.lx > -6.0 && m.lx < 1.8 && m.lz >= 4.6 && m.lz < 8.0) return true;
  }
  for (const b of GARDEN_BEDS) if (Math.hypot(x - b.x, z - b.z) < 1.25 * b.s + pad) return true;
  if (Math.hypot(x - SEED_STAND.x, z - SEED_STAND.z) < 1.0 + pad) return true;
  if (Math.hypot(x - BLITZ_TOTEM.x, z - BLITZ_TOTEM.z) < 0.8 + pad) return true;
  return false;
}

/** Museum-local (x, z) to the world. */
export function museumPoint(lx: number, lz: number) {
  return local(MUSEUM.x, MUSEUM.z, MUSEUM.ry, lx * MUSEUM.s, lz * MUSEUM.s);
}
/** World (x, z) to museum-local metres (unscaled model units). */
export function museumLocal(x: number, z: number) {
  const dx = x - MUSEUM.x;
  const dz = z - MUSEUM.z;
  const c = Math.cos(MUSEUM.ry);
  const s = Math.sin(MUSEUM.ry);
  return { lx: (dx * c - dz * s) / MUSEUM.s, lz: (dx * s + dz * c) / MUSEUM.s };
}
/** The museum's walls (model units): back wall, two side walls, the front wall either side of the doorway. */
export const MUSEUM_WALLS: [number, number, number, number][] = [
  [-6.0, -4.0, 6.0, -4.0],
  [-6.0, -4.0, -6.0, 3.9],
  [6.0, -4.0, 6.0, 3.9],
  [-6.0, 3.9, -1.5, 3.9],
  [1.5, 3.9, 6.0, 3.9],
];
export const MUSEUM_FLOOR = 0.44;

export const BOULDERS: Placed[] = [
  { variant: 1, x: -15.5, z: -8.5, s: 1.3, ry: 0.3 },
  { variant: 0, x: -17.6, z: 2.4, s: 1.0, ry: 1.2 },
  { variant: 2, x: -8.4, z: 11.8, s: 1.1, ry: 2.0 },
  { variant: 0, x: 5.2, z: 14.6, s: 1.2, ry: 0.7 },
  { variant: 1, x: 15.8, z: 3.2, s: 1.1, ry: 2.6 },
  { variant: 2, x: 15.2, z: -9.5, s: 1.3, ry: 1.4 },
  { variant: 0, x: 6.4, z: -17.0, s: 1.5, ry: 0.2 },
  { variant: 1, x: -7.0, z: -17.5, s: 1.4, ry: 2.2 },
  { variant: 2, x: -4.2, z: -5.6, s: 0.55, ry: 0.4 },
  { variant: 2, x: 4.6, z: -6.2, s: 0.5, ry: 1.9 },
  { variant: 0, x: -17.6, z: 13.5, s: 1.6, ry: 0.9 },
  { variant: 1, x: 18.2, z: 13.0, s: 1.4, ry: 2.9 },
  { variant: 2, x: 0.8, z: 18.8, s: 1.2, ry: 1.0 },
];

/** Trees ringing the clearing (beyond where the explorer can walk). */
export const FOREST: Placed[] = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + Math.sin(i * 7.3) * 0.12;
  const r = 25 + ((i * 37) % 7);
  return { variant: 0, x: Math.sin(a) * r, z: -Math.cos(a) * r, s: 0.9 + ((i * 13) % 5) * 0.12, ry: i * 1.7 };
}).filter((p) => !(p.z > 18 && Math.abs(p.x) < 9)); // keep the view south open

export interface Circle {
  x: number;
  z: number;
  r: number;
}

function local(sx: number, sz: number, ry: number, lx: number, lz: number) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: sx + lx * c + lz * s, z: sz - lx * s + lz * c };
}

export function stallPoint(st: StallSpot, lx: number, lz: number) {
  return local(st.x, st.z, st.ry, lx, lz);
}

/** The three plinths in front of each stall, where its district's preview models stand (stall-local x, z). */
export const PLINTHS = [
  { lx: -1.15, lz: 1.45 },
  { lx: 0, lz: 1.6 },
  { lx: 1.15, lz: 1.45 },
];
export const PLINTH_R = 0.32;
export const PLINTH_H = 0.42;

export function colliders(): Circle[] {
  const out: Circle[] = [{ x: TREE.x, z: TREE.z, r: 3.4 }];
  for (const st of STALLS) {
    for (const lx of [-0.75, 0.75]) out.push({ ...stallPoint(st, lx, 0.1), r: 1.05 });
    out.push({ ...stallPoint(st, 1.75, 0.4), r: 0.38 });
    out.push({ ...stallPoint(st, -1.8, 0.1), r: 0.32 });
    for (const p of PLINTHS) out.push({ ...stallPoint(st, p.lx, p.lz), r: PLINTH_R + 0.08 });
  }
  out.push({ x: TELESCOPE.x, z: TELESCOPE.z, r: 0.65 });
  out.push({ x: KEEPER.x, z: KEEPER.z, r: 0.45 });
  for (const p of [...MEADOW.lavender, ...MEADOW.milkweed]) out.push({ x: p.x, z: p.z, r: 0.35 * p.s });
  for (const p of ARENA_PIECES) for (const [lx, lz, r] of p.solid) out.push({ ...local(p.x, p.z, p.ry, lx, lz), r });
  for (const b of GARDEN_BEDS) for (const lx of [-0.5, 0, 0.5]) out.push({ ...local(b.x, b.z, b.ry, lx * b.s, 0), r: 0.5 * b.s });
  out.push({ x: SEED_STAND.x, z: SEED_STAND.z, r: 0.45 });
  out.push({ x: BLITZ_TOTEM.x, z: BLITZ_TOTEM.z, r: 0.5 });
  for (const lx of [-1.5, 1.5]) out.push({ ...local(BLITZ_BANNER.x, BLITZ_BANNER.z, BLITZ_BANNER.ry, lx, 0), r: 0.25 });
  // the museum's walls: a row of small circles along each one
  for (const [ax, az, bx, bz] of MUSEUM_WALLS) {
    const n = Math.max(1, Math.ceil((Math.hypot(bx - ax, bz - az) * MUSEUM.s) / 0.35));
    for (let i = 0; i <= n; i++) out.push({ ...museumPoint(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n), r: 0.22 });
  }
  for (const b of BOULDERS) out.push({ x: b.x, z: b.z, r: (b.variant === 1 ? 1.3 : b.variant === 0 ? 1.0 : 0.7) * b.s * 0.95 });
  return out;
}

/** Ground height under a point: the plaza is a low stone platform. */
export function groundY(x: number, z: number): number {
  // inside the Explorers' Museum: its floor (and the ramp up to the doorway)
  if (Math.abs(x - MUSEUM.x) < 7 && Math.abs(z - MUSEUM.z) < 7) {
    const m = museumLocal(x, z);
    if (Math.abs(m.lx) < 6.1 && m.lz > -4.1 && m.lz < 4.0) return MUSEUM_FLOOR * MUSEUM.s;
    if (Math.abs(m.lx) < 1.6 && m.lz >= 4.0 && m.lz < 7.2) return MUSEUM_FLOOR * MUSEUM.s * (1 - (m.lz - 4.0) / 3.2);
  }
  const r = Math.hypot(x, z);
  if (r < PLAZA_R) return PLAZA_TOP;
  if (r < PLAZA_R + 0.7) return PLAZA_TOP * (1 - (r - PLAZA_R) / 0.7);
  return 0;
}
