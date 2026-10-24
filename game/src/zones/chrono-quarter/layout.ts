// Where everything stands in the Chrono Quarter (metres, Y up; the camera looks north, toward -Z).
// Three era neighbourhoods around a cobbled square: the Roman forum (west), the Classic Maya
// pyramid (north-east) and the Edo garden with its koi pond (south-east). The gate home is south.
// A model's front is its +Z; `ry` turns it (front direction = (sin ry, cos ry)).

export const WORLD_R = 23;
export const SPAWN = { x: 0, y: 0, z: 14.2, ry: Math.PI };
/** The gate home, in the south-west corner, facing the square. */
export const GATE = { x: -17.4, z: 14.4, ry: Math.atan2(17.4, -10.4) };
/** Walk into this circle (the arch of the gate) to go back to the Idea Grove. */
export const EXIT = { x: GATE.x + Math.sin(GATE.ry) * 0.2, z: GATE.z + Math.cos(GATE.ry) * 0.2, r: 1.2 };

export const SQUARE = { x: 0, z: 4, r: 5.6 };
export const DIAL = { x: 0, z: 4, ry: 0 };

export const TEMPLE = { x: -18.6, z: -3.2, ry: Math.PI / 2, s: 0.8 };
export const FOUNTAIN = { x: -9.2, z: -3.0 };
export const PYRAMID = { x: 8.5, z: -14.5, ry: 0, s: 1.0 };
export const PAVILION = { x: 17.6, z: 7.6, ry: -Math.PI / 2 };

/** The koi pond: an ellipse, the bridge crosses it west -> east at z = cz. */
export const POND = { cx: 10, cz: 10, rx: 3.3, rz: 5.0, depth: 0.55, water: -0.12 };
export const BRIDGE = { x: 10, z: 10, len: 7.0, rise: 0.85, halfW: 0.62 };

export interface Spot {
  x: number;
  z: number;
  ry: number;
}

/** Each era's display stand, where its artifacts are brought back. */
export const STANDS: Record<string, Spot> = {
  rome: { x: -10.8, z: 2.6, ry: 0.9 },
  maya: { x: 5.6, z: -3.4, ry: -0.9 },
  edo: { x: 12.6, z: 3.0, ry: -2.2 },
};

export interface Placed {
  variant: number;
  x: number;
  z: number;
  s: number;
  ry: number;
}

export const COLUMNS: Placed[] = [
  { variant: 0, x: -16.6, z: -9.6, s: 1, ry: 0.2 },
  { variant: 0, x: -13.2, z: -9.8, s: 1, ry: 1.1 },
  { variant: 1, x: -9.8, z: -9.2, s: 1, ry: 2.6 },
  { variant: 0, x: -6.6, z: -8.6, s: 1, ry: 0.7 },
  { variant: 0, x: -16.4, z: 3.6, s: 1, ry: 0.4 },
  { variant: 1, x: -13.4, z: 4.4, s: 1, ry: 4.0 },
  { variant: 0, x: -6.2, z: -0.2, s: 0.9, ry: 1.9 },
];

export const STELAE: Spot[] = [
  { x: 2.9, z: -8.6, ry: 0.5 },
  { x: 15.8, z: -4.6, ry: -0.5 },
];

export const STONE_LANTERNS: Spot[] = [
  { x: 6.2, z: 6.2, ry: 0.4 },
  { x: 14.2, z: 14.4, ry: 2.4 },
  { x: 6.0, z: 14.6, ry: 1.2 },
  { x: 14.6, z: 5.0, ry: 2.9 },
];

/** Street lamps along the cobbled streets. */
export const LAMPS: { x: number; z: number }[] = [
  { x: 2.2, z: 14.0 }, { x: -2.2, z: 10.6 }, { x: 4.6, z: 7.2 }, { x: -4.8, z: 0.4 }, { x: 4.2, z: 0.6 },
  { x: -2.1, z: -5.4 }, { x: 2.1, z: -11.0 }, { x: -7.2, z: 5.6 }, { x: 9.0, z: 2.0 }, { x: 15.6, z: 2.2 },
  { x: -15.0, z: 6.4 }, { x: 10.2, z: -2.6 }, { x: -12.8, z: 11.0 }, { x: -12.4, z: 15.6 }, { x: 2.2, z: 18.6 },
];

/** Cherry trees (variant 0/1 of the cherry model). */
export const CHERRIES: Placed[] = [
  // kept to the edges and north of the paths, so they never stand between the 3/4 camera and the explorer
  { variant: 0, x: -4.6, z: -9.6, s: 0.95, ry: 1.7 },
  { variant: 1, x: -1.9, z: -14.2, s: 1.0, ry: 0.4 },
  { variant: 0, x: -8.6, z: -12.8, s: 1.05, ry: 2.6 },
  { variant: 1, x: -12.6, z: -12.2, s: 0.95, ry: 1.1 },
  { variant: 0, x: 19.8, z: 1.2, s: 1.0, ry: 0.4 },
  { variant: 1, x: 15.6, z: 12.8, s: 0.9, ry: 2.7 },
  { variant: 0, x: 11.6, z: 17.2, s: 1.0, ry: 1.2 },
  { variant: 1, x: 7.4, z: 19.8, s: 1.05, ry: 2.0 },
  { variant: 0, x: 16.4, z: 16.4, s: 1.0, ry: 0.6 },
  { variant: 1, x: -18.6, z: 9.2, s: 1.0, ry: 0.8 },
  { variant: 0, x: -20.2, z: 4.4, s: 0.9, ry: 2.9 },
  { variant: 1, x: -14.2, z: 18.6, s: 1.1, ry: 2.2 },
  { variant: 0, x: -9.6, z: 19.0, s: 1.0, ry: 0.3 },
];

/** Palms and broadleaf clumps of the Maya jungle (variant 0 broadleaf, 1 palm). */
export const JUNGLE: Placed[] = (() => {
  const out: Placed[] = [];
  const spots: [number, number, number][] = [
    [1.4, -14, 1], [0.8, -18.4, 1], [15.6, -10.2, 1], [17.2, -14.2, 1], [13.8, -21.2, 1], [3.2, -21.0, 1], [18.6, -6.6, 1],
    [1.6, -11.6, 0], [2.4, -16.2, 0], [15.4, -7.4, 0], [16.4, -12.0, 0], [14.8, -17.6, 0], [4.2, -6.2, 0], [12.6, -5.4, 0],
    [17.6, -3.4, 0], [19.4, -9.6, 0], [0.9, -8.0, 0], [7.4, -7.0, 0],
  ];
  spots.forEach(([x, z, v], i) => out.push({ variant: v, x, z, s: v ? 0.9 + (i % 3) * 0.12 : 0.9 + (i % 4) * 0.18, ry: i * 1.37 }));
  return out;
})();

/** Rocks: around the pond rim (small) and here and there (Idea Grove boulders). */
export const ROCKS: Placed[] = (() => {
  const out: Placed[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const x = POND.cx + Math.sin(a) * (POND.rx + 0.35);
    const z = POND.cz + Math.cos(a) * (POND.rz + 0.3);
    if (Math.abs(z - POND.cz) < 1.5) continue; // leave room for the bridge ends
    out.push({ variant: i % 3, x, z, s: 0.32 + ((i * 7) % 5) * 0.06, ry: i * 2.1 });
  }
  out.push({ variant: 1, x: -20.2, z: 8.4, s: 1.2, ry: 0.5 }, { variant: 0, x: 20.4, z: -2.8, s: 1.0, ry: 1.2 }, { variant: 2, x: -6.2, z: 19.6, s: 0.9, ry: 2.0 },
    { variant: 1, x: 18.6, z: 12.6, s: 0.9, ry: 0.8 }, { variant: 0, x: -19.8, z: -10.6, s: 1.1, ry: 2.4 });
  return out;
})();

/** Background trees beyond the walkable map (Idea Grove forest tree, tinted). */
export const FOREST: Placed[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + Math.sin(i * 5.1) * 0.1;
  const r = 29 + ((i * 29) % 6);
  return { variant: 0, x: Math.sin(a) * r, z: -Math.cos(a) * r, s: 0.85 + ((i * 11) % 5) * 0.1, ry: i * 1.9 };
}).filter((p) => p.z < 6 && !(p.x > 0 && p.z < -12 && p.x < 16));

/** Where lost artifacts can lie; `zone` is the era neighbourhood the spot is in. */
export const ARTIFACT_SPOTS: { x: number; z: number; zone: string }[] = [
  { x: -14.0, z: -6.8, zone: "rome" }, { x: -7.4, z: -6.4, zone: "rome" }, { x: -13.6, z: 1.0, zone: "rome" }, { x: -11.8, z: 7.6, zone: "rome" },
  { x: 3.2, z: -12.6, zone: "maya" }, { x: 14.2, z: -8.4, zone: "maya" }, { x: 9.8, z: -3.2, zone: "maya" }, { x: 18.0, z: -1.2, zone: "maya" },
  { x: 7.6, z: 15.8, zone: "edo" }, { x: 16.2, z: 12.6, zone: "edo" }, { x: 12.6, z: 6.0, zone: "edo" }, { x: 19.0, z: 4.4, zone: "edo" },
  { x: -7.6, z: 13.6, zone: "square" }, { x: -2.6, z: 8.6, zone: "square" }, { x: 3.4, z: 9.8, zone: "square" }, { x: -14.8, z: 9.6, zone: "square" },
  { x: -3.6, z: -2.0, zone: "square" }, { x: 2.6, z: 16.0, zone: "square" },
];

// ------------------------------------------------------------------ ground: streets and paving
/** Cobbled streets: segments [ax, az, bx, bz, halfWidth]. */
export const STREETS: [number, number, number, number, number][] = [
  [0, 21, 0, -11.5, 1.7],
  [-19, 4, 19, 4, 1.5],
  [0, -5.2, 7.8, -5.2, 1.6],
  [7.8, -5.2, 8.5, -6.2, 1.6],
  [3.4, 7.4, 6.6, 10, 1.0],
  [13.4, 10, 15.2, 8.2, 1.0],
  [0, 12.6, -9.4, 12.6, 1.1],
  [-9.4, 12.6, -16.4, 13.8, 1.2],
  [0, 11.2, 5.8, 15.6, 0.9],
];

/** Stone-slab plazas (forum, Maya plaza): [cx, cz, halfX, halfZ]. */
export const PAVING: [number, number, number, number][] = [
  [-13.8, -2.2, 7.6, 7.4],
  [8.5, -5.6, 6.4, 1.6],
];

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * k, pz - az - dz * k);
}

function wobble(x: number, z: number) {
  return Math.sin(x * 1.3 + z * 0.4) * 0.12 + Math.sin(z * 2.1 - x * 0.7) * 0.08;
}

/** 0 grass … 1 cobbles. */
export function streetMask(x: number, z: number): number {
  let d = Math.hypot(x - SQUARE.x, z - SQUARE.z) - SQUARE.r;
  for (const s of STREETS) d = Math.min(d, segDist(x, z, s[0], s[1], s[2], s[3]) - s[4]);
  return Math.max(0, Math.min(1, 0.5 - (d + wobble(x, z)) * 2.2));
}

/** 0 … 1 large stone slabs. */
export function pavingMask(x: number, z: number): number {
  let best = 0;
  for (const p of PAVING) {
    const dx = Math.abs(x - p[0]) - p[2];
    const dz = Math.abs(z - p[1]) - p[3];
    const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - 0.6;
    best = Math.max(best, Math.max(0, Math.min(1, 0.5 - (d + wobble(x, z) * 2) * 1.6)));
  }
  return best;
}

/** Normalised distance from the pond centre (1 = the water's edge). */
export function pondR(x: number, z: number): number {
  return Math.hypot((x - POND.cx) / POND.rx, (z - POND.cz) / POND.rz);
}

/** The ground mesh's height (the pond is a hollow). */
export function terrainY(x: number, z: number): number {
  const r = pondR(x, z);
  if (r >= 1.08) return 0;
  const k = Math.min(1, (1.08 - r) / 0.32);
  return -POND.depth * k * k * (3 - 2 * k);
}

/** Bridge deck height for an x along the bridge (same curve as the Blender model). */
export function bridgeY(x: number): number {
  const t = (x - (BRIDGE.x - BRIDGE.len / 2)) / BRIDGE.len;
  if (t <= 0 || t >= 1) return 0.05;
  return 0.05 + BRIDGE.rise * Math.sin(Math.PI * t);
}

/** Where an explorer's feet are: on the bridge, on the Time Dial's step, or the ground. */
export function groundY(x: number, z: number): number {
  if (Math.abs(z - BRIDGE.z) < BRIDGE.halfW + 0.3 && Math.abs(x - BRIDGE.x) < BRIDGE.len / 2 + 0.2) return bridgeY(x);
  return 0;
}

// ------------------------------------------------------------------ solid shapes
export interface Circle {
  x: number;
  z: number;
  r: number;
}

function local(x: number, z: number, ry: number, lx: number, lz: number) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

/** A rotated rectangle's outline as a chain of circles. */
function rectCircles(x: number, z: number, ry: number, hx: number, hz: number, r: number): Circle[] {
  const out: Circle[] = [];
  const step = r * 1.3;
  const add = (lx: number, lz: number) => out.push({ ...local(x, z, ry, lx, lz), r });
  for (let lx = -hx; lx <= hx + 1e-6; lx += Math.min(step, (2 * hx) / Math.max(1, Math.round((2 * hx) / step)))) {
    add(lx, -hz);
    add(lx, hz);
  }
  for (let lz = -hz; lz <= hz + 1e-6; lz += Math.min(step, (2 * hz) / Math.max(1, Math.round((2 * hz) / step)))) {
    add(-hx, lz);
    add(hx, lz);
  }
  return out;
}

let cached: Circle[] | null = null;

export function colliders(): Circle[] {
  if (cached) return cached;
  const out: Circle[] = [];
  // temple (podium + front stairs), scaled
  const ts = TEMPLE.s;
  out.push(...rectCircles(TEMPLE.x, TEMPLE.z, TEMPLE.ry, 4.9 * ts, 5.6 * ts, 0.7));
  {
    // the stairs: a block in front of the podium (you can't climb in, it's sacred)
    const f = local(TEMPLE.x, TEMPLE.z, TEMPLE.ry, 0, (5.5 + 1.45) * ts);
    out.push(...rectCircles(f.x, f.z, TEMPLE.ry, 4.8 * ts, 1.45 * ts, 0.55));
  }
  out.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: 2.55 });
  for (const c of COLUMNS) out.push({ x: c.x, z: c.z, r: c.variant ? 0.75 : 0.6 });
  // pyramid with its staircase
  out.push(...rectCircles(PYRAMID.x, PYRAMID.z, PYRAMID.ry, 6.6, 6.6, 0.9));
  out.push(...rectCircles(PYRAMID.x, PYRAMID.z + 7.9, 0, 2.2, 1.3, 0.7));
  for (const s of STELAE) {
    out.push({ ...local(s.x, s.z, s.ry, 0, 0), r: 0.7 }, { ...local(s.x, s.z, s.ry, 0, 1.25), r: 0.68 });
  }
  // pavilion
  out.push(...rectCircles(PAVILION.x, PAVILION.z, PAVILION.ry, 2.9, 2.4, 0.6));
  // pond: everything inside the water, except a corridor over the bridge
  for (let gx = POND.cx - POND.rx; gx <= POND.cx + POND.rx + 0.01; gx += 0.9)
    for (let gz = POND.cz - POND.rz; gz <= POND.cz + POND.rz + 0.01; gz += 0.9) {
      if (pondR(gx, gz) > 1.0) continue;
      if (Math.abs(gz - POND.cz) < 1.25) continue;
      out.push({ x: gx, z: gz, r: 0.72 });
    }
  // bridge railings: keep explorers on the deck while they cross
  for (let x = BRIDGE.x - BRIDGE.len / 2 + 0.4; x <= BRIDGE.x + BRIDGE.len / 2 - 0.3; x += 0.55) {
    if (pondR(x, POND.cz) > 1.0) continue;
    out.push({ x, z: BRIDGE.z - BRIDGE.halfW - 0.55, r: 0.3 }, { x, z: BRIDGE.z + BRIDGE.halfW + 0.55, r: 0.3 });
  }
  for (const l of STONE_LANTERNS) out.push({ x: l.x, z: l.z, r: 0.5 });
  for (const l of LAMPS) out.push({ x: l.x, z: l.z, r: 0.28 });
  for (const c of CHERRIES) out.push({ x: c.x, z: c.z, r: 0.42 * c.s });
  for (const j of JUNGLE) if (j.variant === 1) out.push({ x: j.x, z: j.z, r: 0.35 });
  for (const r of ROCKS) out.push({ x: r.x, z: r.z, r: (r.variant === 1 ? 1.3 : r.variant === 0 ? 1.0 : 0.7) * r.s * 0.95 });
  // the Time Dial and the three era stands
  out.push({ x: DIAL.x, z: DIAL.z, r: 1.45 });
  for (const k of Object.keys(STANDS)) out.push({ x: STANDS[k].x, z: STANDS[k].z, r: 0.85 });
  // the gate's piers (the arch between them is the way home)
  for (const sx of [-1, 1]) out.push({ ...local(GATE.x, GATE.z, GATE.ry, sx * 2.05, 0), r: 0.85 }, { ...local(GATE.x, GATE.z, GATE.ry, sx * 2.05, -0.5), r: 0.85 });
  cached = out;
  return out;
}
