// The butterfly net in the explorer's hands while it is out: held low in front, it swings across with
// the sweep (the drag on the sweep pad, or the held Space key), its bag trailing behind the hoop.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Game } from "../game/state";
import { useExp } from "../game/expedition";
import { useModel } from "./assets";

function NetModel({ url, game }: { url: string; game: Game }) {
  const gltf = useModel(url);
  const { obj, bag } = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.frustumCulled = false;
    });
    return { obj: o, bag: o.getObjectByName("net_bag") };
  }, [gltf]);
  const g = useRef<THREE.Group>(null);
  const swing = useRef(0);
  const prev = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = useExp.getState();
    const grp = g.current;
    if (!grp) return;
    const on = st.mode === "net" && game.mode === "play" && !game.cam.aim;
    grp.visible = on;
    if (!on) return;
    const me = game.me;
    // a short automatic follow-through after a sweep ends
    const since = (performance.now() - st.sweepAt) / 1000;
    const k = st.sweepK >= 0 ? st.sweepK : since < 0.35 ? 1 : 0;
    swing.current += (k - swing.current) * Math.min(1, dt * 14);
    const s = swing.current;
    // the grip in the right hand; the hoop sweeps from the right, low in front, to the left
    const c = Math.cos(me.ry);
    const sn = Math.sin(me.ry);
    const lx = 0.32 - s * 0.5;
    const lz = 0.25;
    grp.position.set(me.x + lx * c + lz * sn, me.y + 0.95, me.z - lx * sn + lz * c);
    grp.rotation.set(0, 0, 0);
    grp.rotateY(me.ry + 0.9 - s * 1.8);
    grp.rotateX(1.05);
    if (bag) {
      const v = (s - prev.current) / Math.max(dt, 1e-3);
      bag.rotation.x = THREE.MathUtils.clamp(-v * 0.25, -0.6, 0.6) + Math.sin(performance.now() / 400) * 0.05;
    }
    prev.current = s;
  });
  return (
    <group ref={g} visible={false} scale={1.05}>
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
    /* no net model: the sweep pad still works */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeldNet({ url, game }: { url: string; game: Game }) {
  if (!url) return null;
  return (
    <Guard>
      <React.Suspense fallback={null}>
        <NetModel url={url} game={game} />
      </React.Suspense>
    </Guard>
  );
}
