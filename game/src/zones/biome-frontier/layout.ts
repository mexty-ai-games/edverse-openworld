// Where everything stands in the Biome Frontier (metres, Y up; the camera looks north, toward -Z).
// Three linked areas in one bounded map: the rainforest + waterfall (west), the fossil canyon (north,
// across the river, reached by the rope bridge) and the coral coast + research pier (east). The trail
// gate back to the Idea Grove is in the south, behind the spawn point.
// Exports for the hub's movement / camera code: SPAWN, WORLD_R, EXIT, colliders(), groundY().

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface Spot {
  x: number;
  z: number;
  ry: number;
  s?: number;
}

/** Radius of the walkable disc (the hub clamps the explorer inside it). */
export const WORLD_R = 31;
export const SPAWN = { x: 0, y: 0, z: 15.5, ry: Math.PI };
/** Step into this circle to go back to the Idea Grove. */
export const EXIT = { x: 0, z: 23.6, r: 1.5 };
export const GATE: Spot = { x: 0, z: 24.2, ry: 0 };

// ------------------------------------------------------------------ water: sea, river, waterfall pool
/** The beach meets the sea at this x (it waves gently along the coast). */
export function shoreX(z: number): number {
  return 16 + Math.sin(z * 0.19 + 0.6) * 1.3 + Math.sin(z * 0.07) * 0.8;
}

/** The waterfall cliff in the north-west; its front (+Z) faces the field station. */
export const CLIFF: Spot = { x: -15, z: -25, ry: Math.atan2(15, 25) };
/** Where the falling water lands (computed from the cliff). */
export const POOL = { x: CLIFF.x + Math.sin(CLIFF.ry) * 6.6, z: CLIFF.z + Math.cos(CLIFF.ry) * 6.6, r: 4.4 };
/** The river: from the pool to the sea, a polyline with a half width. */
export const RIVER: [number, number][] = [
  [POOL.x, POOL.z],
  [-7.5, -15.2],
  [-3, -12.2],
  [3, -11.2],
  [9, -11.6],
  [14, -11],
  [21, -10.2],
];
export const RIVER_HW = 2.3;

/** The rope bridge crosses the river north-south at x = 3 (model runs along its +X; turned to face north). */
export const BRIDGE = { x: 3, z: -6.0, len: 10.0, ry: Math.PI / 2, hw: 0.8 };

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * k, pz - az - dz * k);
}

export function riverDist(x: number, z: number): number {
  let d = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) d = Math.min(d, segDist(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]));
  return d;
}

/** Signed distance to open water (negative = in water): river, pool, sea. */
export function waterDist(x: number, z: number): number {
  const river = riverDist(x, z) - RIVER_HW - Math.sin(x * 0.7 + z * 0.3) * 0.25;
  const pool = Math.hypot(x - POOL.x, z - POOL.z) - POOL.r;
  const sea = shoreX(z) - x;
  return Math.min(river, pool, sea);
}

// ------------------------------------------------------------------ the three areas
/** Region weights at a point: [rainforest, canyon, sand]. Smooth, sums to 1. */
export function regionWeights(x: number, z: number): [number, number, number] {
  const sm = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // the canyon: north of the river, east of the waterfall
  const canyon = Math.min(1, sm(-14.5, -17.5, z + Math.sin(x * 0.4) * 0.8) * sm(-9, -5, x) + sm(-13, -16, z) * sm(-5, -2, x) * 0.6);
  const sand = sm(-6.5, -3.0, x - shoreX(z)) * (1 - canyon * 0.85); // a beach band along the sea
  const c = canyon * (1 - sand);
  const f = Math.max(0, 1 - sand - c);
  return [f, c, sand];
}

// ------------------------------------------------------------------ set pieces
export const STATION: Spot = { x: -1.5, z: 3.5, ry: 0.15 };
export const PIER = { x: 14.2, z: 3.5, top: 0.55, len: 12, hw: 1.2 };
export const DIG: Spot = { x: 8.5, z: -21, ry: -0.12 };
export const SIGNPOST: Spot = { x: 3.2, z: 9.5, ry: 0.4 };

/** Area boards (icon signs) at the entrance of each area. */
export const BOARDS: (Spot & { key: "forest" | "canyon" | "coast" | "grove"; biome: string })[] = [
  { key: "forest", biome: "rainforest", x: -7.6, z: 7.5, ry: 0.9 },
  { key: "canyon", biome: "canyon", x: 5.4, z: -17.4, ry: -0.2 },
  { key: "coast", biome: "coast", x: 9.6, z: 7.0, ry: -0.9 },
];

/** Canyon walls and mesas (model node names in canyonRocks). */
export const ROCKS: (Spot & { node: string })[] = [
  { node: "wall_a", x: 3.5, z: -28.5, ry: 0.05, s: 1.2 },
  { node: "wall_b", x: 14.5, z: -25.5, ry: -0.7, s: 1.1 },
  { node: "mesa", x: -4.5, z: -27.5, ry: 0.4, s: 1.1 },
  { node: "mesa", x: 18.5, z: -17.0, ry: -1.3, s: 0.95 },
  { node: "wall_b", x: -9.5, z: -30, ry: 0.5, s: 1.0 },
  { node: "wall_a", x: 24, z: -27, ry: -0.9, s: 1.1 },
  { node: "rock_c", x: 12.5, z: -17.5, ry: 0.8, s: 1 },
  { node: "rock_a", x: -1.5, z: -21.5, ry: 2.0, s: 1 },
  { node: "rock_b", x: 4.5, z: -23.0, ry: 0.4, s: 1.2 },
  { node: "rock_a", x: 15.5, z: -20.5, ry: 1.1, s: 0.8 },
  { node: "rock_b", x: -6.5, z: -18.6, ry: 2.6, s: 1.0 },
  { node: "rock_c", x: 1.0, z: -25.0, ry: 2.8, s: 0.7 },
];

/** Glowing field cards: where the 8 cards of a round lie (2-3 in each area). */
export const CARD_SPOTS: Spot[] = [
  { x: -9.5, z: 12.0, ry: 0 },
  { x: -15.5, z: 1.0, ry: 0 },
  { x: -9.8, z: -8.0, ry: 0 },
  { x: 2.0, z: -19.0, ry: 0 },
  { x: 13.0, z: -15.0, ry: 0 },
  { x: -5.5, z: -21.0, ry: 0 },
  { x: 12.0, z: -2.5, ry: 0 },
  { x: 11.0, z: 13.0, ry: 0 },
];

/** Where the species live in the world (decor, not the round's cards). */
export const CRITTERS = {
  toucan: { x: SIGNPOST.x, z: SIGNPOST.z, y: 2.3, ry: 0.6 },
  frog: { x: -8.9, z: -10.2, ry: 0.7 },
  morpho: { x: -11, z: 5, ry: 0 },
  tortoise: { x: 6, z: -16.5, ry: -0.6 },
  lizard: { x: 12.5, z: -17.5, y: 1.15, ry: 2.2 },
  saguaro: [
    { x: 10.6, z: -22.5, ry: 0.2, s: 1.0 },
    { x: 0.5, z: -23.0, ry: 1.4, s: 0.8 },
    { x: 16, z: -21.5, ry: 2.4, s: 1.15 },
    { x: -2.5, z: -17.6, ry: 0.4, s: 0.6 },
    { x: 7.5, z: -25.4, ry: 2.0, s: 0.9 },
  ],
  turtle: { x: 21, z: 8, ry: 0 },
  clownfish: { x: 19.2, z: -3.5, ry: 0 },
  seaStar: { x: 14.6, z: 9.5, ry: 0.5 },
  cameraTraps: [
    { x: -12.5, z: 9.5, ry: 2.4 },
    { x: 9.5, z: -14.5, ry: -2.6 },
    { x: 11.5, z: 0.5, ry: -1.4 },
  ],
};

export const CORALS: (Spot & { node: string })[] = (() => {
  const out: (Spot & { node: string })[] = [];
  const nodes = ["coral_brain", "coral_branch", "coral_fan", "coral_tubes"];
  let a = 12345;
  const r = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  for (let i = 0; i < 46; i++) {
    const z = -8 + r() * 26;
    const x = shoreX(z) + 1.8 + r() * 6.5;
    if (Math.abs(z - PIER.z) < 1.6 && x < PIER.x + PIER.len + 4) continue;
    out.push({ node: nodes[i % 4], x, z, ry: r() * 6.28, s: 0.8 + r() * 0.9 });
  }
  return out;
})();

// ------------------------------------------------------------------ height of the walkable ground
function bridgeT(x: number, z: number): number {
  // 0..1 along the bridge when on its deck, else -1
  if (Math.abs(x - BRIDGE.x) > BRIDGE.hw + 0.1) return -1;
  const t = (BRIDGE.z - z) / BRIDGE.len;
  return t >= 0 && t <= 1 ? t : -1;
}

/** Height of the land itself: flat, sloping down into the water near the banks, hills beyond the edge. */
export function landHeight(x: number, z: number): number {
  const wd = waterDist(x, z);
  if (wd < 0) {
    const sea = shoreX(z) - x;
    // a shallow turquoise shelf in the sea (corals stay visible), deeper fresh water in the river and pool
    if (sea <= wd + 1e-6) return -0.32 - Math.min(2.6, -sea * 0.16 + Math.max(0, -sea - 12) * 0.3);
    return -0.3 - Math.min(1.7, -wd * 0.55);
  }
  let h = wd < 0.9 ? -0.3 * (1 - wd / 0.9) ** 2 : 0;
  const r = Math.hypot(x, z);
  if (r > WORLD_R + 1.5 && x < shoreX(z) - 6) {
    const k = Math.min(1, (r - WORLD_R - 1.5) / 12);
    h += k * k * (3 - 2 * k) * (z < -20 ? 9 : 5) * Math.min(1, (shoreX(z) - 6 - x) / 8);
  }
  return h;
}

/** Ground height under a point: the land; the pier deck and the sagging rope bridge are raised. */
export function groundY(x: number, z: number): number {
  const bt = bridgeT(x, z);
  if (bt >= 0) return 0.12 - 0.35 * Math.sin(bt * Math.PI) + 0.03;
  const px0 = PIER.x - 1.2;
  if (Math.abs(z - PIER.z) <= PIER.hw + 0.1 && x >= px0 && x <= PIER.x + PIER.len) return x < PIER.x ? (PIER.top * (x - px0)) / 1.2 : PIER.top;
  if (Math.abs(z - PIER.z) <= 2.0 && x >= PIER.x + PIER.len - 0.4 && x <= PIER.x + PIER.len + 3.6) return PIER.top;
  return Math.max(-0.3, landHeight(x, z));
}

// ------------------------------------------------------------------ solid shapes
function chain(out: Circle[], pts: [number, number][], r: number, step = 0.9) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k <= n; k++) out.push({ x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n, r });
  }
}

let cached: Circle[] | null = null;
/** Everything the explorer walks around: water (river, pool, sea), cliffs, rocks, buildings, trees. */
export function colliders(): Circle[] {
  if (cached) return cached;
  const out: Circle[] = [];
  // river and pool: circles on the centre line, a gap where the bridge crosses
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      if (Math.abs(x - BRIDGE.x) < RIVER_HW + 1.2) continue;
      out.push({ x, z, r: RIVER_HW - 0.1 });
    }
  }
  out.push({ x: POOL.x, z: POOL.z, r: POOL.r - 0.2 });
  // the river beside the bridge: rails on both sides
  for (const side of [-1, 1]) chain(out, [[BRIDGE.x + side * (BRIDGE.hw + 0.45), BRIDGE.z - 1.0], [BRIDGE.x + side * (BRIDGE.hw + 0.45), BRIDGE.z - BRIDGE.len + 1.0]], 0.45, 0.6);
  for (const side of [-1, 1]) chain(out, [[BRIDGE.x + side * (BRIDGE.hw + 2.0), BRIDGE.z - 3.0], [BRIDGE.x + side * (BRIDGE.hw + 2.0), BRIDGE.z - BRIDGE.len + 3.0]], 1.5, 0.8);
  // the sea: a chain just off the shore, a gap for the pier
  for (let z = -34; z <= 34; z += 0.9) {
    if (Math.abs(z - PIER.z) < PIER.hw + 0.25) continue;
    out.push({ x: shoreX(z) + 0.9, z, r: 1.0 });
  }
  // pier rails and its end platform
  chain(out, [[PIER.x - 1.0, PIER.z - PIER.hw - 0.3], [PIER.x + PIER.len - 0.6, PIER.z - PIER.hw - 0.3]], 0.3, 0.5);
  chain(out, [[PIER.x - 1.0, PIER.z + PIER.hw + 0.3], [PIER.x + PIER.len - 0.6, PIER.z + PIER.hw + 0.3]], 0.3, 0.5);
  chain(out, [[PIER.x + PIER.len - 0.4, PIER.z - 2.3], [PIER.x + PIER.len + 3.9, PIER.z - 2.3], [PIER.x + PIER.len + 3.9, PIER.z + 2.3], [PIER.x + PIER.len - 0.4, PIER.z + 2.3]], 0.3, 0.5);
  out.push({ x: PIER.x + PIER.len + 2.2, z: PIER.z - 1.2, r: 0.8 }); // research table
  out.push({ x: PIER.x + PIER.len + 0.9, z: PIER.z + 1.4, r: 0.6 }); // crates
  // waterfall cliff (a wide wall of circles along its width)
  for (let k = -7; k <= 7; k += 1.4) {
    const c = Math.cos(CLIFF.ry);
    const s = Math.sin(CLIFF.ry);
    out.push({ x: CLIFF.x + k * c - 0.5 * s, z: CLIFF.z - k * s - 0.5 * c, r: 3.0 });
  }
  // canyon rocks
  const R: Record<string, number> = { wall_a: 0, wall_b: 0, mesa: 3.0, rock_a: 1.1, rock_b: 0.75, rock_c: 1.5 };
  for (const rk of ROCKS) {
    const s = rk.s || 1;
    if (rk.node === "wall_a" || rk.node === "wall_b") {
      const half = (rk.node === "wall_a" ? 6 : 4.5) * s;
      const c = Math.cos(rk.ry);
      const sn = Math.sin(rk.ry);
      for (let k = -half + 1.6; k <= half - 1.6; k += 1.6) out.push({ x: rk.x + k * c, z: rk.z - k * sn, r: 1.9 * s });
    } else out.push({ x: rk.x, z: rk.z, r: R[rk.node] * s });
  }
  // dig face, field station, signs, gate posts, critters
  {
    const c = Math.cos(DIG.ry);
    const sn = Math.sin(DIG.ry);
    for (const k of [-1.6, 0, 1.6]) out.push({ x: DIG.x + k * c, z: DIG.z - k * sn - 0.2, r: 0.85 });
  }
  {
    const c = Math.cos(STATION.ry);
    const sn = Math.sin(STATION.ry);
    for (const [lx, lz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) out.push({ x: STATION.x + lx * c + lz * sn, z: STATION.z - lx * sn + lz * c, r: 1.45 });
  }
  out.push({ x: SIGNPOST.x, z: SIGNPOST.z, r: 0.3 });
  for (const b of BOARDS) out.push({ x: b.x, z: b.z, r: 0.5 });
  out.push({ x: GATE.x - 1.9, z: GATE.z, r: 0.3 }, { x: GATE.x + 1.9, z: GATE.z, r: 0.3 });
  out.push({ x: CRITTERS.tortoise.x, z: CRITTERS.tortoise.z, r: 0.45 });
  for (const s of CRITTERS.saguaro) out.push({ x: s.x, z: s.z, r: 0.45 * s.s });
  for (const t of TREES) out.push({ x: t.x, z: t.z, r: 0.9 * (t.s || 1) });
  for (const p of PALMS) out.push({ x: p.x, z: p.z, r: 0.35 });
  cached = out;
  return out;
}

// ------------------------------------------------------------------ trees (placed by rule, seeded)
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True where nothing big should grow: trails, clearings, water, set pieces. */
export function keepClear(x: number, z: number, pad = 0): boolean {
  if (waterDist(x, z) < 1.2 + pad) return true;
  if (Math.hypot(x - STATION.x, z - STATION.z) < 6 + pad) return true;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4 + pad) return true;
  if (Math.abs(x - GATE.x) < 2.6 + pad && z > 15 && z < 27) return true;
  if (pad >= 0 && x > -7 - pad && x < 9 + pad && z > 7 && z < 30) return true; // the open view north from the gate
  if (Math.hypot(x - DIG.x, z - DIG.z) < 4 + pad) return true;
  if (Math.abs(x - BRIDGE.x) < 2 + pad && z < BRIDGE.z + 3 && z > BRIDGE.z - BRIDGE.len - 3) return true;
  for (const c of CARD_SPOTS) if (Math.hypot(x - c.x, z - c.z) < 2.2 + pad) return true;
  for (const b of BOARDS) if (Math.hypot(x - b.x, z - b.z) < 1.8 + pad) return true;
  if (Math.hypot(x - SIGNPOST.x, z - SIGNPOST.z) < 1.8 + pad) return true;
  return trailDist(x, z) < 1.4 + pad;
}

/** The main dirt trails (spawn -> station -> forest / bridge / beach). */
export const TRAILS: [number, number][][] = [
  [[0, 23], [0.5, 15], [-0.5, 9], [STATION.x, STATION.z + 3.5]],
  [[STATION.x - 3, STATION.z + 1], [-7, 6], [-11, 3], [-15, 0], [-17, -5]],
  [[-11, 3], [-10, -4], [-9, -8]],
  [[STATION.x + 2, STATION.z - 2], [2.5, -2], [BRIDGE.x, BRIDGE.z + 0.5]],
  [[BRIDGE.x, BRIDGE.z - BRIDGE.len - 0.5], [4, -18], [DIG.x, DIG.z + 2.2]],
  [[4, -18], [-1, -20], [-6, -21]],
  [[4, -18], [11, -16], [14, -15]],
  [[STATION.x + 3, STATION.z + 1], [8, 4], [PIER.x - 1.5, PIER.z]],
  [[0.5, 15], [6, 13], [11, 12]],
];

export function trailDist(x: number, z: number): number {
  let d = 1e9;
  for (const t of TRAILS) for (let i = 0; i < t.length - 1; i++) d = Math.min(d, segDist(x, z, t[i][0], t[i][1], t[i + 1][0], t[i + 1][1]));
  return d;
}

/** Giant rainforest trees: the west, and a ring around the map's edge in the south. */
export const TREES: Spot[] = (() => {
  const R = seeded(77);
  const out: Spot[] = [];
  let guard = 0;
  while (out.length < 26 && guard++ < 3000) {
    const x = -28 + R() * 24;
    const z = -14 + R() * 38;
    const w = regionWeights(x, z);
    if (w[0] < 0.9 || keepClear(x, z, 1.5)) continue;
    if (Math.hypot(x, z) > WORLD_R + 6) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 5.2)) continue;
    out.push({ x, z, ry: R() * 6.28, s: 0.85 + R() * 0.45 });
  }
  // a few around the pool's north bank (the waterfall side)
  for (const [x, z] of [[-21, -17], [-19, -11], [-8.5, -24], [-23, -4]] as [number, number][]) out.push({ x, z, ry: R() * 6.28, s: 1.0 + R() * 0.3 });
  return out;
})();

/** Palms along the beach and the forest edge. */
export const PALMS: Spot[] = (() => {
  const R = seeded(91);
  const out: Spot[] = [];
  let guard = 0;
  while (out.length < 11 && guard++ < 3000) {
    const z = -8 + R() * 30;
    const x = shoreX(z) - 1.2 - R() * 3.2;
    if (keepClear(x, z, 0.4) || Math.hypot(x, z) > WORLD_R + 2 || z > 18) continue;
    if (Math.abs(z - PIER.z) < 3 && x > PIER.x - 4) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    // the model leans along its +X: toward the sea (east), give or take
    out.push({ x, z, ry: (R() - 0.5) * 1.6, s: 0.8 + R() * 0.4 });
  }
  return out;
})();
