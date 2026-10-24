import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

/** MEXTY media-library URLs sit behind the player's login: their requests carry its cookies. */
export function needsLogin(url: string): boolean {
  return /(^|\.)mexty\.ai\/|(^|\.)mext\.app\//.test(url.replace(/^https?:\/\//, ""));
}

/** A .glb model prop, prepared once: shadows on, foliage alpha-clipped and double-sided. */
export function useModel(url: string) {
  const gltf = useGLTF(url, false, false, (loader) => {
    (loader as unknown as { setWithCredentials: (b: boolean) => void }).setWithCredentials(needsLogin(url));
  });
  const s = gltf.scene as THREE.Object3D & { userData: { owReady?: boolean } };
  if (!s.userData.owReady) {
    s.userData.owReady = true;
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats as THREE.MeshStandardMaterial[]) {
        if (mat.alphaTest > 0 || mat.transparent) {
          mat.transparent = false;
          mat.alphaTest = Math.max(0.4, mat.alphaTest);
          mat.side = THREE.DoubleSide;
          mat.alphaToCoverage = false;
        }
        if (mat.map) mat.map.anisotropy = 4;
      }
    });
  }
  return gltf;
}

/** Tiling images (ground): sRGB, repeat, mipmapped; MEXTY URLs carry the player's credentials. */
export function useTiles(urls: string[]): THREE.Texture[] {
  const tex = useLoader(THREE.TextureLoader, urls, (loader) => {
    loader.setCrossOrigin(urls.some(needsLogin) ? "use-credentials" : "anonymous");
  }) as THREE.Texture[];
  for (const t of tex) {
    if (t.userData.owReady) continue;
    t.userData.owReady = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  return tex;
}

/** A soft round sprite (glows, fireflies), drawn once. */
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,240,200,1)");
  grd.addColorStop(0.25, "rgba(255,200,110,0.55)");
  grd.addColorStop(1, "rgba(255,170,60,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Wind: foliage sways a little (vertex shader), from one shared clock. */
export const wind = { value: 0 };
export function addWind(mat: THREE.Material, strength = 1) {
  const m = mat as THREE.Material & { userData: { owWind?: boolean } };
  if (m.userData.owWind) return;
  m.userData.owWind = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 owW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
          vec4 owW = modelMatrix * vec4(transformed, 1.0);
        #endif
        float owH = max(transformed.y, 0.0) * ${strength.toFixed(3)};
        transformed.x += sin(uWind * 1.6 + owW.x * 0.55 + owW.z * 0.35) * 0.07 * owH;
        transformed.z += cos(uWind * 1.2 + owW.x * 0.4 - owW.z * 0.3) * 0.05 * owH;`,
      );
  };
  m.needsUpdate = true;
}
