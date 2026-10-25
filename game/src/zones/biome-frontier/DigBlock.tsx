// The real dig in 3D: the layered dig block in the canyon. Rubbing the trowel over it scrapes the top layer
// down and away (its node pivots at its base), the soft brush cleans the dust off an uncovered fossil, and
// little puffs of soil fly. The rules are in dig.ts; the panel and the timeline in Activity.tsx.
import React, { useMemo, useRef } from "react";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Fossil } from "../../block";
import { glowTexture, useModel } from "../../scene/assets";
import { digStroke } from "./dig";
import { DIG_LAYERS, exposedFossil, useSurvey } from "./store";
import { DIG_BLOCK, landHeight } from "./layout";

const DUST = new THREE.Color("#8a6a48");

function FossilModel({ f }: { f: Fossil }) {
  const gltf = useModel(f.modelUrl);
  const { obj, mats } = useMemo(() => {
    const o = gltf.scene.clone(true);
    const mats: { m: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      mats.push({ m: m.material as THREE.MeshStandardMaterial, base: (m.material as THREE.MeshStandardMaterial).color.clone() });
    });
    return { obj: o, mats };
  }, [gltf]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = useSurvey.getState().dig;
    const grp = g.current;
    if (!grp) return;
    const shown = d.removed > Math.min(f.layer, DIG_LAYERS - 1);
    grp.visible = shown;
    if (!shown) return;
    const b = d.found.indexOf(f.id) >= 0 ? 1 : d.brushed[f.id] || 0;
    // dusty and half buried until brushed; clean and lifted a little once found
    for (const x of mats) x.m.color.copy(x.base).lerp(DUST, (1 - b) * 0.8);
    grp.position.set(f.spot[0], f.spot[1] - 0.025 * (1 - b), f.spot[2]);
  });
  return (
    <group ref={g} userData={{ fossil: f.id }} visible={false}>
      <primitive object={obj} />
    </group>
  );
}

class Guard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* a fossil that cannot load is simply not drawn */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Puff {
  sp: THREE.Sprite;
  v: THREE.Vector3;
  t: number;
}

export function DigBlock({ url, fossils }: { url: string; fossils: Fossil[] }) {
  const gltf = useModel(url);
  const obj = useMemo(() => gltf.scene.clone(true), [gltf]);
  const layers = useMemo(() => Array.from({ length: DIG_LAYERS }, (_, i) => obj.getObjectByName("dig_layer" + i) || null), [obj]);
  const root = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.Group>(null);
  const pool = useRef<Puff[]>([]);
  const drag = useRef<{ id: number; last: THREE.Vector3 } | null>(null);
  const y0 = landHeight(DIG_BLOCK.x, DIG_BLOCK.z);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const d = useSurvey.getState().dig;
    layers.forEach((o, i) => {
      if (!o) return;
      o.visible = i >= d.removed;
      // the layer being scraped sinks toward its base
      const k = i === d.removed ? 1 - 0.85 * d.scrape : 1;
      o.scale.y += (k - o.scale.y) * Math.min(1, dt * 10);
    });
    for (const p of pool.current) {
      if (p.t <= 0) continue;
      p.t -= dt;
      p.sp.position.addScaledVector(p.v, dt);
      p.v.y -= dt * 0.8;
      (p.sp.material as THREE.SpriteMaterial).opacity = Math.max(0, p.t / 0.8) * 0.8;
      p.sp.visible = p.t > 0;
    }
  });

  const puff = (local: THREE.Vector3, brush: boolean) => {
    const g = puffs.current;
    if (!g) return;
    let p = pool.current.find((x) => x.t <= 0);
    if (!p && pool.current.length < 16) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: brush ? "#e8d6b0" : "#9a7a52", transparent: true, depthWrite: false }));
      g.add(sp);
      p = { sp, v: new THREE.Vector3(), t: 0 };
      pool.current.push(p);
    }
    if (!p) return;
    p.sp.position.copy(local);
    p.sp.scale.setScalar(brush ? 0.08 : 0.14);
    p.v.set((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
    p.t = 0.8;
  };

  const toLocal = (e: ThreeEvent<PointerEvent>) => (root.current ? root.current.worldToLocal(e.point.clone()) : e.point.clone());
  const what = (e: ThreeEvent<PointerEvent>, local: THREE.Vector3): "soil" | "fossil" => {
    for (let o: THREE.Object3D | null = e.object; o; o = o.parent) if (o.userData && o.userData.fossil) return "fossil";
    const ex = exposedFossil(useSurvey.getState().dig, fossils);
    if (ex && Math.hypot(local.x - ex.spot[0], local.z - ex.spot[2]) < 0.17) return "fossil";
    return "soil";
  };
  const down = (e: ThreeEvent<PointerEvent>) => {
    if (!useSurvey.getState().view || useSurvey.getState().view!.kind !== "dig") return;
    e.stopPropagation();
    drag.current = { id: e.pointerId, last: toLocal(e) };
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const dr = drag.current;
    if (!dr || dr.id !== e.pointerId) return;
    e.stopPropagation();
    const local = toLocal(e);
    const dist = Math.min(0.3, local.distanceTo(dr.last));
    if (dist < 0.01) return;
    dr.last = local;
    const tool = useSurvey.getState().dig.tool;
    const on = what(e, local);
    digStroke(fossils, on, dist * (tool === "trowel" ? 0.9 : 3.2));
    if (Math.random() < 0.6) puff(local, tool === "brush");
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <group ref={root} position={[DIG_BLOCK.x, y0, DIG_BLOCK.z]} rotation-y={DIG_BLOCK.ry} scale={DIG_BLOCK.s || 1} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
      <primitive object={obj} />
      {fossils.map((f) =>
        f.modelUrl ? (
          <Guard key={f.id}>
            <React.Suspense fallback={null}>
              <FossilModel f={f} />
            </React.Suspense>
          </Guard>
        ) : null,
      )}
      <group ref={puffs} />
    </group>
  );
}
