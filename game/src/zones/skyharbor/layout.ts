// Where everything stands on the Skyharbor plateau (metres, Y up; the camera looks north, toward -Z).
// Models are props; this is the structure that places them and the solid shapes the explorer walks around.
// The plateau is flat (ground at 0) and ends in railed cliffs; the explorer is kept inside WORLD_R.

export const WORLD_R = 17.4;
/** Radius of the walkable plateau's ground disc and of the railing ring. */
export const PLATEAU_R = 19.6;
export const RAIL_R = 18.3;

function facing(x: number, z: number) {
  // the model's front (+Z) turned toward the plateau centre
  return Math.atan2(-x, -z);
}

/** A point in an object's own frame (lx right, lz toward its front) in world space. */
export function local(o: { x: number; z: number; ry: number }, lx: number, lz: number) {
  const c = Math.cos(o.ry);
  const s = Math.sin(o.ry);
  return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
}

export interface Spot {
  x: number;
  z: number;
  ry: number;
  s?: number;
}

export const OBSERVATORY: Spot = { x: 9.0, z: -9.6, ry: facing(9.0, -9.6), s: 1.2 };
export const WORKSHOP: Spot = { x: -7.6, z: -7.0, ry: facing(-7.6, -7.0) + 0.25 };
/** The courier robot stands in front of its workshop. */
export const ROBOT: Spot = (() => {
  const p = local(WORKSHOP, 0.6, 3.0);
  return { x: p.x, z: p.z, ry: WORKSHOP.ry - 0.3 };
})();
export const GREENHOUSES: Spot[] = [
  { x: -1.6, z: -15.2, ry: facing(-1.6, -15.2), s: 1.2 },
  { x: 14.0, z: 3.6, ry: facing(14.0, 3.6), s: 1.0 },
  { x: 4.6, z: 12.6, ry: facing(4.6, 12.6), s: 0.85 },
];
/** The pier sticks out of the west cliff; the airship is moored at its end. */
export const DOCK: Spot = { x: -17.4, z: -1.0, ry: -Math.PI / 2 };
export const AIRSHIP = { x: -27.6, y: 0.35, z: -1.0, ry: Math.PI / 2 };
/** The exit gate back to the Idea Grove (south-west), facing the plateau. */
export const GATE: Spot = { x: -13.4, z: 8.6, ry: facing(-13.4, 8.6) };
export const EXIT = (() => {
  const p = local(GATE, 0, -0.2);
  return { x: p.x, z: p.z, r: 1.15 };
})();
export const SPAWN = (() => {
  const p = local(GATE, -1.0, 6.2);
  return { x: p.x, y: 0, z: p.z, ry: GATE.ry };
})();

/** Benches and crates around the plaza. */
export const BENCHES: Spot[] = [
  { x: 4.6, z: 4.6, ry: facing(4.6, 4.6) },
  { x: -1.0, z: 6.8, ry: facing(-1.0, 6.8) },
];
export const CRATES: Spot[] = [
  { x: -14.6, z: -3.6, ry: 0.3, s: 1.0 },
  { x: -15.2, z: -2.6, ry: 1.1, s: 0.8 },
  { x: -14.4, z: 1.6, ry: 0.7, s: 0.9 },
  { x: -4.0, z: -9.6, ry: 0.2, s: 0.75 },
  { x: 12.2, z: -4.2, ry: 0.9, s: 0.8 },
];
export const ROCKS: Spot[] = [
  { x: 16.0, z: -6.5, ry: 0.4, s: 1.1 },
  { x: -10.8, z: -13.2, ry: 1.3, s: 1.3 },
  { x: 10.4, z: 13.4, ry: 2.1, s: 0.9 },
  { x: -16.0, z: 5.0, ry: 0.2, s: 0.8 },
  { x: 3.2, z: -16.8, ry: 2.6, s: 1.0 },
];
/** Lamp posts: around the plaza and along the main paths. */
export const LAMPS: Spot[] = [
  ...Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    return { x: Math.sin(a) * 7.6, z: Math.cos(a) * 7.6, ry: -a - Math.PI / 2 };
  }),
  { x: -14.6, z: 0.6, ry: Math.PI },
  { x: -14.6, z: -2.8, ry: Math.PI },
  { x: -10.4, z: 10.9, ry: 0.6 },
];
/** Big trees just outside the railing (OpenWorld's forest tree, in the night light). */
export const TREES: Spot[] = [
  { x: -19.5, z: -12.5, ry: 0.3, s: 1.1 },
  { x: 13.0, z: -16.5, ry: 1.7, s: 1.25 },
  { x: 20.0, z: -4.0, ry: 2.4, s: 0.95 },
  { x: -20.5, z: 11.5, ry: 0.9, s: 1.0 },
];

/** The railing ring is cut where the pier leaves the cliff. */
export function railOpen(a: number): boolean {
  const pier = Math.atan2(DOCK.x, DOCK.z);
  let d = Math.abs(a - pier) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d < 0.11;
}

// --------------------------------------------------------------------------- paved ground
const PAVED_DISCS: [number, number, number][] = [
  [0, 0, 6.6],
  [OBSERVATORY.x, OBSERVATORY.z, 6.4],
];
function pathTo(o: Spot, lz: number, w: number): [number, number, number, number, number] {
  const p = local(o, 0, lz);
  return [0, 0, p.x, p.z, w];
}
const PAVED_SEGS: [number, number, number, number, number][] = [
  pathTo(OBSERVATORY, 5.4, 1.3),
  pathTo(WORKSHOP, 2.6, 1.4),
  pathTo(GATE, 1.5, 1.2),
  [0, 0, DOCK.x, DOCK.z, 1.3],
  pathTo(GREENHOUSES[0], 3.5, 0.9),
  pathTo(GREENHOUSES[1], 3.0, 0.9),
  pathTo(GREENHOUSES[2], 2.6, 0.9),
];

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * k, pz - az - dz * k);
}

/** How much flagstone shows at a point (0 moss … 1 paving), with soft, wobbly edges. */
export function paveMask(x: number, z: number): number {
  const wob = Math.sin(x * 0.9 + z * 0.4) * 0.25 + Math.sin(z * 1.6 - x * 0.7) * 0.18;
  let d = 9;
  for (const [cx, cz, r] of PAVED_DISCS) d = Math.min(d, Math.hypot(x - cx, z - cz) - r);
  for (const s of PAVED_SEGS) d = Math.min(d, segDist(x, z, s[0], s[1], s[2], s[3]) - s[4]);
  return Math.max(0, Math.min(1, 0.5 - (d + wob * 0.5) * 0.9));
}

// --------------------------------------------------------------------------- solids
export interface Circle {
  x: number;
  z: number;
  r: number;
}

export function colliders(): Circle[] {
  const out: Circle[] = [];
  out.push({ x: OBSERVATORY.x, z: OBSERVATORY.z, r: 4.6 * (OBSERVATORY.s || 1) });
  // workshop: its floor box (5.4 x 3.4), as three circles along its width, plus the flywheel
  for (const lx of [-1.8, 0, 1.8]) out.push({ ...local(WORKSHOP, lx, -0.3), r: 1.6 });
  out.push({ ...local(WORKSHOP, 3.1, -0.6), r: 0.9 });
  out.push({ x: ROBOT.x, z: ROBOT.z, r: 0.5 });
  for (const g of GREENHOUSES) out.push({ x: g.x, z: g.z, r: 3.3 * (g.s || 1) });
  for (const lx of [-1.7, 1.7]) out.push({ ...local(GATE, lx, 0), r: 0.62 });
  for (const b of BENCHES) out.push({ x: b.x, z: b.z, r: 0.75 });
  for (const c of CRATES) out.push({ x: c.x, z: c.z, r: 0.5 * (c.s || 1) });
  for (const r of ROCKS) out.push({ x: r.x, z: r.z, r: 1.15 * (r.s || 1) });
  for (const l of LAMPS) out.push({ x: l.x, z: l.z, r: 0.25 });
  return out;
}

/** Ground height under a point: the plateau is flat. */
export function groundY(_x: number, _z: number): number {
  return 0;
}

/** Where the info / activity targets are (the explorer stands here to use them). */
export const TARGETS = {
  robot: (() => {
    const p = local(ROBOT, 0, 1.2);
    return { x: p.x, z: p.z, reach: 2.2 };
  })(),
  planets: (() => {
    const p = local(OBSERVATORY, 0, 6.3);
    return { x: p.x, z: p.z, reach: 2.3 };
  })(),
  greenhouse: (() => {
    const g = GREENHOUSES[0];
    const p = local(g, 0, 3.3 * (g.s || 1) + 1.0);
    return { x: p.x, z: p.z, reach: 2.2 };
  })(),
  airship: { x: DOCK.x + 1.4, z: DOCK.z, reach: 2.6 },
};
