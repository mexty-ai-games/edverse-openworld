import React, { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { BlockProps, DistrictPreview } from "../block";
import { PLINTHS, PLINTH_H, PLINTH_R, STALLS, stallPoint } from "../game/layout";
import { needsLogin } from "./assets";

/** Catalogue models may be meshopt-compressed: this loader decodes them (the grove's own models are not). */
function usePreviewGltf(url: string) {
  return useGLTF(url, false, true, (loader) => {
    (loader as unknown as { setWithCredentials: (b: boolean) => void }).setWithCredentials(needsLogin(url));
  });
}

/** A preview that cannot load just stays away: the stall and the grove keep working. */
class QuietGuard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* a missing preview is not worth an error screen */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const PREVIEW_SIZE = 0.78;

/** One catalogue model, scaled to fit the plinth, turning slowly; animated models play their idle (or first) clip. */
function PreviewModel({ url, phase }: { url: string; phase: number }) {
  const gltf = usePreviewGltf(url);
  const spin = useRef<THREE.Group>(null);
  const { obj, mixer } = useMemo(() => {
    const o = cloneSkinned(gltf.scene) as THREE.Object3D;
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const k = PREVIEW_SIZE / Math.max(size.x, size.y, size.z, 1e-3);
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    o.position.set(-c.x, -box.min.y, -c.z);
    wrap.add(o);
    wrap.scale.setScalar(k);
    let mx: THREE.AnimationMixer | null = null;
    const clips = gltf.animations || [];
    if (clips.length) {
      const clip = clips.find((a) => /idle/i.test(a.name)) || clips[0];
      mx = new THREE.AnimationMixer(o);
      mx.clipAction(clip).play();
    }
    return { obj: wrap, mixer: mx };
  }, [gltf]);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    if (spin.current) spin.current.rotation.y += d * 0.45;
    if (mixer) mixer.update(d);
  });
  return (
    <group ref={spin} rotation-y={phase}>
      <primitive object={obj} />
    </group>
  );
}

function Plinth() {
  const mats = useMemo(
    () => ({
      stone: new THREE.MeshStandardMaterial({ color: "#b8ad92", roughness: 0.92 }),
      top: new THREE.MeshStandardMaterial({ color: "#8fae6b", roughness: 0.85 }),
    }),
    [],
  );
  return (
    <group>
      <mesh castShadow receiveShadow position-y={PLINTH_H / 2} material={mats.stone}>
        <cylinderGeometry args={[PLINTH_R * 0.86, PLINTH_R, PLINTH_H, 14]} />
      </mesh>
      <mesh receiveShadow position-y={PLINTH_H + 0.012} material={mats.top}>
        <cylinderGeometry args={[PLINTH_R * 0.9, PLINTH_R * 0.9, 0.025, 14]} />
      </mesh>
    </group>
  );
}

function StallPreviewRow({ spot, previews }: { spot: (typeof STALLS)[number]; previews: DistrictPreview[] }) {
  return (
    <>
      {PLINTHS.map((p, i) => {
        const at = stallPoint(spot, p.lx, p.lz);
        const pv = previews[i];
        return (
          <group key={i} position={[at.x, 0, at.z]} rotation-y={spot.ry}>
            <Plinth />
            {pv && pv.modelUrl && (
              <QuietGuard>
                <Suspense fallback={null}>
                  <group position-y={PLINTH_H + 0.03}>
                    <PreviewModel url={pv.modelUrl} phase={i * 2.1} />
                  </group>
                </Suspense>
              </QuietGuard>
            )}
          </group>
        );
      })}
    </>
  );
}

/** Every district's preview models, on plinths in front of its stall. Loads after the grove and never blocks it. */
export function StallPreviews({ props }: { props: BlockProps }) {
  return (
    <>
      {STALLS.map((st) => (
        <StallPreviewRow key={st.key} spot={st} previews={((props.districts || []).find((d) => d.id === st.district)?.previews || []).slice(0, 3)} />
      ))}
    </>
  );
}
