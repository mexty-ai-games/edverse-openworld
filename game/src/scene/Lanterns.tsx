import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { BlockProps } from "../block";
import type { Game } from "../game/state";
import type { QualityPlan } from "../settings";
import type { CardState } from "../ui/Cards";
import { TREE } from "../game/layout";
import { glowTexture, useModel } from "./assets";

const SCALE = 1.35;
const MAX = 36;

/** Lantern hooks of the tree model (empties named hook_NN), in world space, front of the tree first. */
function useHooks(url: string) {
  const gltf = useModel(url);
  return useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(TREE.x, 0, TREE.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), TREE.ry),
      new THREE.Vector3(TREE.scale, TREE.scale, TREE.scale),
    );
    const out: THREE.Vector3[] = [];
    gltf.scene.traverse((o) => {
      if (/^hook_/.test(o.name)) out.push(o.getWorldPosition(new THREE.Vector3()).applyMatrix4(m));
    });
    // the ones facing the plaza first, alternating left and right
    out.sort((a, b) => b.z - a.z);
    return out;
  }, [gltf]);
}

/** Where lantern i hangs: a hook, or (past the hooks) beside one, a little lower. */
function spot(hooks: THREE.Vector3[], i: number): THREE.Vector3 {
  if (!hooks.length) return new THREE.Vector3(TREE.x + Math.sin(i) * 4, 6, TREE.z + Math.cos(i) * 4);
  const h = hooks[i % hooks.length];
  const ring = Math.floor(i / hooks.length);
  if (!ring) return h.clone();
  const a = i * 2.399;
  return h.clone().add(new THREE.Vector3(Math.sin(a) * 0.8 * ring, -0.45 * ring, Math.cos(a) * 0.8 * ring));
}

export function Lanterns({ props, game, plan, onOpen }: { props: BlockProps; game: Game; plan: QualityPlan; onOpen: (c: CardState) => void }) {
  const hooks = useHooks(props.models.tree);
  const lantern = useModel(props.models.lantern);
  const lanterns = props.lanterns || [];
  const gl = useThree((s) => s.gl);
  const count = Math.min(MAX, Math.max(hooks.length, lanterns.length));
  const items = useMemo(() => {
    const glowSrc = (() => {
      let g: THREE.MeshStandardMaterial | null = null;
      lantern.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && /glow/.test((m.material as THREE.Material).name)) g = m.material as THREE.MeshStandardMaterial;
      });
      return g as THREE.MeshStandardMaterial | null;
    })();
    const unlit = glowSrc ? glowSrc.clone() : null;
    if (unlit) {
      unlit.emissiveIntensity = 0.05;
      unlit.color.multiplyScalar(0.55);
    }
    return Array.from({ length: count }, (_, i) => {
      const lit = i < lanterns.length;
      const obj = lantern.scene.clone(true);
      const glow = lit && glowSrc ? glowSrc.clone() : unlit;
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && glow && /glow/.test((m.material as THREE.Material).name)) m.material = glow;
      });
      return { obj, glow, lit, pos: spot(hooks, i), phase: i * 1.37 };
    });
  }, [lantern, hooks, count, lanterns.length]);

  // lanterns are things to read: register where to stand under each one
  useEffect(() => {
    const others = game.targets.filter((t) => t.kind !== "lantern");
    game.targets = others.concat(items.map((it, i) => ({ key: "lantern-" + i, kind: "lantern" as const, ref: i, x: it.pos.x, z: it.pos.z, reach: 2.6 })));
  }, [items, game]);

  const groups = useRef<(THREE.Group | null)[]>([]);
  const halos = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const focus = game.focus && game.focus.kind === "lantern" ? (game.focus.ref as number) : -1;
    items.forEach((it, i) => {
      const g = groups.current[i];
      if (g) {
        g.rotation.z = Math.sin(t * 0.9 + it.phase) * 0.06;
        g.rotation.x = Math.cos(t * 0.7 + it.phase) * 0.05;
      }
      const flick = 0.9 + 0.1 * Math.sin(t * 7 + it.phase * 3) * Math.sin(t * 3.1 + it.phase);
      const boost = i === focus ? 1.6 : 1;
      if (it.lit && it.glow) it.glow.emissiveIntensity = 3.2 * flick * boost;
      const h = halos.current[i];
      if (h) {
        const s = (it.lit ? 2.1 : 0.0) * (0.92 + 0.08 * flick) * (i === focus ? 1.3 : 1);
        h.scale.set(s, s, s);
      }
    });
  });

  const lightAt = useMemo(() => {
    const lit = items.filter((x) => x.lit).map((x) => x.pos);
    if (!lit.length) return [] as THREE.Vector3[];
    const avg = lit.reduce((a, b) => a.clone().add(b), new THREE.Vector3()).multiplyScalar(1 / lit.length);
    return [avg.clone().add(new THREE.Vector3(0, -1.6, 0.6))];
  }, [items]);

  const halo = glowTexture();
  return (
    <group>
      {items.map((it, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g;
          }}
          position={it.pos}
          scale={SCALE}
          onClick={(e) => {
            e.stopPropagation();
            onOpen({ kind: "lantern", index: i, empty: !it.lit });
          }}
          onPointerOver={() => (gl.domElement.style.cursor = "pointer")}
          onPointerOut={() => (gl.domElement.style.cursor = "")}
        >
          <primitive object={it.obj} />
          <sprite
            ref={(s) => {
              halos.current[i] = s;
            }}
            position={[0, -0.78, 0]}
            renderOrder={8}
          >
            <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} color="#ffc977" opacity={0.85} fog={false} />
          </sprite>
        </group>
      ))}
      {plan.extras &&
        lightAt.map((p, i) => <pointLight key={i} position={p} color="#ffbf6b" intensity={22} distance={16} decay={1.6} />)}
    </group>
  );
}
