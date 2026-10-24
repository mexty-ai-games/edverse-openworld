// Small scene helpers for Skyharbor (same patterns as the hub's World.tsx, kept local to the district).
import * as THREE from "three";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Part {
  name: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** Meshes of a model (or of its nodes whose name passes `filter`) baked to geometries, for instancing. */
export function meshesOf(scene: THREE.Object3D, filter?: (name: string) => boolean): Part[] {
  scene.updateMatrixWorld(true);
  const out: Part[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (filter && !filter(m.name) && !filter(m.parent?.name || "")) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    out.push({ name: m.name, geo, mat: m.material as THREE.Material });
  });
  return out;
}

export function mat4(x: number, y: number, z: number, ry: number, s: number, sy = s, sx = s) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, s));
  return m;
}

/** Every material of a model with this name (materials are shared between its meshes). */
export function materialsNamed(root: THREE.Object3D, test: (name: string) => boolean): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const x of list) if (test(x.name)) out.add(x as THREE.MeshStandardMaterial);
  });
  return Array.from(out);
}

/** A soft round sprite tinted to a colour (glows of lamps, fireflies, plants). */
const glowCache = new Map<string, THREE.Texture>();
export function tintedGlow(inner: string, outer: string): THREE.Texture {
  const key = inner + outer;
  const have = glowCache.get(key);
  if (have) return have;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.3, outer);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glowCache.set(key, t);
  return t;
}
