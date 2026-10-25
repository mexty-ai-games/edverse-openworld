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

export interface Placed {
  variant: number;
  x: number;
  z: number;
  s: number;
  ry: number;
}

export const BOULDERS: Placed[] = [
  { variant: 1, x: -15.5, z: -8.5, s: 1.3, ry: 0.3 },
  { variant: 0, x: -13.6, z: 5.4, s: 1.0, ry: 1.2 },
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
  for (const b of BOULDERS) out.push({ x: b.x, z: b.z, r: (b.variant === 1 ? 1.3 : b.variant === 0 ? 1.0 : 0.7) * b.s * 0.95 });
  return out;
}

/** Ground height under a point: the plaza is a low stone platform. */
export function groundY(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < PLAZA_R) return PLAZA_TOP;
  if (r < PLAZA_R + 0.7) return PLAZA_TOP * (1 - (r - PLAZA_R) / 0.7);
  return 0;
}
