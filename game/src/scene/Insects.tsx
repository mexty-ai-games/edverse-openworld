// The insects of the expedition's second part, each where it really lives and doing what it really does:
// in the Idea Grove meadow, a honeybee drinks nectar on the lavender and a monarch caterpillar munches
// milkweed; in the Biome Frontier, a dung beetle rolls its ball, a locust jumps and a tiger beetle sprints on
// the canyon's sand, while in the rainforest a leafcutter ant carries leaves along the trail, a snail glides
// in the damp shade by the pool, a firefly glows under the big trees and a camouflaged stick insect keeps
// still among the plants at the forest's edge. All of them can be caught with the net (and must be let go where they were found).
import React, { useMemo } from "react";
import * as THREE from "three";
import type { ExpeditionProps, GuideSpecies } from "../block";
import type { Game } from "../game/state";
import { useModel } from "./assets";
import { MEADOW } from "../game/layout";
import { Brain, Creature, newBrain, setBehaviour, Think, turnTo, walkTo } from "./creatures";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function near(x: number, z: number, r: number) {
  const a = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * r;
  return { x: x + Math.sin(a) * d, z: z + Math.cos(a) * d };
}

// ------------------------------------------------------------------ brains
/** The bee flies from flower to flower (hovering) and drinks nectar at each one. */
function beeThink(flowers: { x: number; y: number; z: number }[]): Think {
  let at = 0;
  return (b, dt, time) => {
    if (b.behaviour === "move") {
      const f = flowers[at];
      b.y += (f.y + 0.25 + Math.sin(time * 5) * 0.05 - b.y) * Math.min(1, dt * 3);
      if (walkTo(b, dt, 0.9, 6) && b.t > 1) setBehaviour(b, "feed", rnd(2.5, 4.5));
      return;
    }
    const f = flowers[at];
    b.y += (f.y - b.y) * Math.min(1, dt * 4);
    if (b.left > 0) return;
    at = (at + 1 + Math.floor(Math.random() * (flowers.length - 1))) % flowers.length;
    b.ax = flowers[at].x;
    b.az = flowers[at].z;
    setBehaviour(b, "move", 5);
  };
}

/** The caterpillar clings to its milkweed stem, munching most of the time, and creeps slowly up and down it. */
function caterpillarThink(stem: { x: number; z: number; lo: number; hi: number }): Think {
  let up = true;
  return (b, dt) => {
    b.x = stem.x;
    b.z = stem.z + 0.045;
    b.ry = Math.PI;
    if (b.behaviour === "move") {
      const want = up ? stem.hi : stem.lo;
      b.y += Math.sign(want - b.y) * Math.min(Math.abs(want - b.y), 0.05 * dt);
      if (Math.abs(want - b.y) < 0.005 || b.left <= 0) {
        up = !up;
        setBehaviour(b, "feed", rnd(6, 10));
      }
      return;
    }
    if (b.left > 0) return;
    setBehaviour(b, Math.random() < 0.3 ? "idle" : "move", Math.random() < 0.3 ? rnd(2, 4) : 12);
  };
}

/** Walks slowly around a home point (a snail glides, a stick insect sways and freezes). */
function wanderThink(home: { x: number; z: number }, r: number, speed: number, special: number, ground: (x: number, z: number) => number, idleMore = 0.5): Think {
  return (b, dt) => {
    b.y = ground(b.x, b.z);
    if (b.behaviour === "move") {
      if (walkTo(b, dt, speed, 2) || b.left <= 0) setBehaviour(b, "idle", rnd(3, 6));
      return;
    }
    if (b.left > 0) return;
    const roll = Math.random();
    if (roll < special) setBehaviour(b, "special", rnd(3, 5));
    else if (roll < special + idleMore) setBehaviour(b, "idle", rnd(3, 6));
    else {
      const p = near(home.x, home.z, r);
      b.ax = p.x;
      b.az = p.z;
      setBehaviour(b, "move", 20);
    }
  };
}

/** The dung beetle rolls its ball round and round its patch of sand. */
function dungThink(home: { x: number; z: number }, r: number, ground: (x: number, z: number) => number): Think {
  let a = 0;
  return (b, dt) => {
    b.y = ground(b.x, b.z);
    if (b.behaviour === "special") {
      // rolling: the beetle walks backwards (it faces away from where it goes)
      a += dt * 0.12;
      const nx = home.x + Math.cos(a) * r;
      const nz = home.z + Math.sin(a) * r;
      turnTo(b, Math.atan2(b.x - nx, b.z - nz), dt * 4);
      b.x = nx;
      b.z = nz;
      if (b.left <= 0) setBehaviour(b, "idle", rnd(2, 3.5));
      return;
    }
    if (b.left <= 0) setBehaviour(b, "special", rnd(7, 11));
  };
}

/** The locust sits, then jumps: a big arc forward, its wings flashing open. */
function locustThink(home: { x: number; z: number }, r: number, ground: (x: number, z: number) => number): Think {
  let from = { x: 0, z: 0 };
  return (b, dt) => {
    if (b.behaviour === "special") {
      const k = Math.min(1, b.t / 0.9);
      const kk = Math.max(0, (k - 0.25) / 0.75);
      b.x = from.x + (b.ax - from.x) * kk;
      b.z = from.z + (b.az - from.z) * kk;
      b.y = ground(b.x, b.z);
      if (k >= 1) setBehaviour(b, "idle", rnd(3, 6));
      return;
    }
    b.y = ground(b.x, b.z);
    if (b.left > 0) return;
    if (Math.random() < 0.4) {
      setBehaviour(b, "feed", rnd(2, 4));
      return;
    }
    from = { x: b.x, z: b.z };
    let p = near(home.x, home.z, r);
    if (Math.hypot(p.x - b.x, p.z - b.z) < 0.6) p = { x: home.x, z: home.z };
    b.ax = p.x;
    b.az = p.z;
    b.ry = Math.atan2(p.x - b.x, p.z - b.z);
    setBehaviour(b, "special", 0.9);
  };
}

/** The tiger beetle sprints, stops to look, sprints again (it runs too fast to see while running). */
function tigerThink(home: { x: number; z: number }, r: number, ground: (x: number, z: number) => number): Think {
  return (b, dt) => {
    b.y = ground(b.x, b.z);
    if (b.behaviour === "special") {
      if (walkTo(b, dt, 2.2, 20) || b.left <= 0) setBehaviour(b, Math.random() < 0.4 ? "feed" : "idle", rnd(0.8, 2));
      return;
    }
    if (b.left > 0) return;
    const p = near(home.x, home.z, r);
    b.ax = p.x;
    b.az = p.z;
    setBehaviour(b, "special", 1.6);
  };
}

/** The leafcutter ant walks its trail carrying a leaf, stops to cut, walks back. */
function antThink(a: { x: number; z: number }, c: { x: number; z: number }, ground: (x: number, z: number) => number): Think {
  let toC = true;
  return (b, dt) => {
    b.y = ground(b.x, b.z);
    if (b.behaviour === "move") {
      const t = toC ? c : a;
      b.ax = t.x;
      b.az = t.z;
      if (walkTo(b, dt, 0.32, 5)) {
        toC = !toC;
        setBehaviour(b, toC ? "idle" : "special", rnd(2, 4));
      }
      return;
    }
    if (b.left <= 0) setBehaviour(b, "move", 60);
  };
}

/** The firefly hovers slowly in the shade, then lands on a leaf for a moment. */
function fireflyThink(home: { x: number; y: number; z: number }): Think {
  return (b, dt, time) => {
    if (b.behaviour === "move" || b.behaviour === "special") {
      b.y += (home.y + Math.sin(time * 1.3) * 0.25 - b.y) * Math.min(1, dt * 2);
      if (walkTo(b, dt, 0.35, 3) && b.left <= 0) setBehaviour(b, "idle", rnd(2, 4));
      if (b.left <= 0 && b.behaviour === "special") setBehaviour(b, "move", 6);
      return;
    }
    b.y += (home.y - 0.35 - b.y) * Math.min(1, dt * 2);
    if (b.left > 0) return;
    const p = near(home.x, home.z, 1.3);
    b.ax = p.x;
    b.az = p.z;
    setBehaviour(b, Math.random() < 0.4 ? "special" : "move", rnd(4, 7));
  };
}

/** The firefly's lantern: a soft glow, and a bright flash every 5.5 seconds (the common eastern firefly's rhythm). */
function fireflyGlow(light: { current: THREE.PointLight | null }) {
  return (body: THREE.Object3D, b: Brain, time: number) => {
    const ph = time % 5.5;
    const flash = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) : 0;
    const k = 0.35 + flash * 3.2 + (b.behaviour === "special" ? 0.4 : 0);
    body.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.name === "firefly_glow" && m.emissive) {
        if (m.emissive.getHex() === 0) m.emissive.set("#d8ff6a");
        m.emissiveIntensity = k;
      }
    });
    if (light.current) light.current.intensity = 0.15 + flash * 1.6;
  };
}

// ------------------------------------------------------------------ plants they live on
function Plant({ url, node, x, z, s = 1, ry = 0 }: { url: string; node: string; x: number; z: number; s?: number; ry?: number }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(node);
    const g = new THREE.Group();
    if (src) {
      const c = src.clone(true);
      c.position.set(0, 0, 0);
      g.add(c);
    }
    return g;
  }, [gltf, node]);
  return <primitive object={obj} position={[x, 0, z]} scale={s} rotation-y={ry} />;
}

class Guard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* a plant that cannot load is left out */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useBy(exp: ExpeditionProps) {
  return useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);
}

export function GroveInsects({ exp, game }: { exp: ExpeditionProps; game: Game }) {
  const by = useBy(exp);
  const flowers = useMemo(() => MEADOW.lavender.map((l) => ({ x: l.x, y: 0.6 * l.s + 0.02, z: l.z })), []);
  const cat = useMemo(() => {
    const m = MEADOW.milkweed[0];
    return { x: m.x, z: m.z, lo: 0.45 * m.s, hi: 0.72 * m.s };
  }, []);
  const cast = useMemo(
    () => ({
      bee: { brain: newBrain(flowers[0].x, flowers[0].y, flowers[0].z), think: beeThink(flowers) },
      cat: { brain: newBrain(cat.x, cat.lo, cat.z + 0.045, Math.PI), think: caterpillarThink(cat) },
    }),
    [flowers, cat],
  );
  const bee = by.honeybee;
  const cp = by["monarch-caterpillar"];
  return (
    <>
      {exp.models.lavender &&
        MEADOW.lavender.map((l, i) => (
          <Guard key={"lv" + i}>
            <React.Suspense fallback={null}>
              <Plant url={exp.models.lavender} node="lavender_flowering" x={l.x} z={l.z} s={l.s} ry={l.ry} />
            </React.Suspense>
          </Guard>
        ))}
      {exp.models.milkweed &&
        MEADOW.milkweed.map((l, i) => (
          <Guard key={"mw" + i}>
            <React.Suspense fallback={null}>
              <Plant url={exp.models.milkweed} node="milkweed_flowering" x={l.x} z={l.z} s={l.s} ry={l.ry} />
            </React.Suspense>
          </Guard>
        ))}
      {bee && <Creature id="grove-bee" species={bee.id} url={bee.modelUrl} icon={bee.icon} scale={(bee.scale || 1) * 0.75} game={game} brain={cast.bee.brain} think={cast.bee.think} catchable home={{ x: flowers[0].x, z: flowers[0].z, r: 3 }} fleeSpeed={2} clipMap={{ move: "fly", idle: "fly" }} />}
      {cp && <Creature id="grove-caterpillar" species={cp.id} url={cp.modelUrl} icon={cp.icon} scale={(cp.scale || 1) * 0.7} game={game} brain={cast.cat.brain} think={cast.cat.think} catchable shy="none" pitch={-Math.PI / 2} clipMap={{ feed: "eat" }} />}
    </>
  );
}

/** Where the Biome Frontier's insects live (canyon sand, rainforest trail, shade and the pool's damp bank). */
export const FRONTIER_SPOTS = {
  dung: { x: 11.8, z: -20.0, r: 0.8 },
  locust: { x: 2.8, z: -19.8, r: 1.6 },
  tiger: { x: 5.2, z: -18.3, r: 1.6 },
  antA: { x: -11.6, z: 4.3 },
  antB: { x: -14.6, z: 2.1 },
  snail: { x: -14.5, z: -14.0, r: 0.9 },
  firefly: { x: -14.2, y: 1.1, z: 7.6 },
  stick: { x: -6.6, z: 0.9, r: 0.3 },
};

export function FrontierInsects({ exp, game, ground }: { exp: ExpeditionProps; game: Game; ground: (x: number, z: number) => number }) {
  const by = useBy(exp);
  const S = FRONTIER_SPOTS;
  const light = useMemo(() => ({ current: null as THREE.PointLight | null }), []);
  const cast = useMemo(
    () => ({
      dung: { brain: newBrain(S.dung.x + S.dung.r, ground(S.dung.x, S.dung.z), S.dung.z), think: dungThink(S.dung, S.dung.r, ground) },
      locust: { brain: newBrain(S.locust.x, ground(S.locust.x, S.locust.z), S.locust.z, 1), think: locustThink(S.locust, S.locust.r, ground) },
      tiger: { brain: newBrain(S.tiger.x, ground(S.tiger.x, S.tiger.z), S.tiger.z), think: tigerThink(S.tiger, S.tiger.r, ground) },
      ant: { brain: newBrain(S.antA.x, ground(S.antA.x, S.antA.z), S.antA.z), think: antThink(S.antA, S.antB, ground) },
      snail: { brain: newBrain(S.snail.x, ground(S.snail.x, S.snail.z), S.snail.z, 2), think: wanderThink(S.snail, S.snail.r, 0.05, 0.2, ground) },
      firefly: { brain: newBrain(S.firefly.x, S.firefly.y, S.firefly.z), think: fireflyThink(S.firefly) },
      stick: { brain: newBrain(S.stick.x, ground(S.stick.x, S.stick.z), S.stick.z, 2.4), think: wanderThink(S.stick, S.stick.r, 0.04, 0.35, ground, 0.55) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const glow = useMemo(() => fireflyGlow(light), [light]);
  const one = (key: keyof typeof cast, id: string, extra: Partial<React.ComponentProps<typeof Creature>> = {}) => {
    const s = by[id];
    if (!s) return null;
    return (
      <Creature
        key={key}
        id={"bf-" + key}
        species={id}
        url={s.modelUrl}
        icon={s.icon}
        scale={s.scale || 1}
        game={game}
        brain={cast[key].brain}
        think={cast[key].think}
        ground={ground}
        catchable
        fleeSpeed={1.6}
        {...extra}
      />
    );
  };
  const stick = by["stick-insect"];
  return (
    <>
      {one("dung", "dung-beetle", { clipMap: { special: "push" }, home: { x: S.dung.x, z: S.dung.z, r: 2 } })}
      {one("locust", "locust", { clipMap: { special: "jump" }, home: { x: S.locust.x, z: S.locust.z, r: 2 } })}
      {one("tiger", "tiger-beetle", { clipMap: { special: "run" }, home: { x: S.tiger.x, z: S.tiger.z, r: 2 }, fleeSpeed: 3 })}
      {one("ant", "leafcutter-ant", { clipMap: { move: "carry" }, home: { x: S.antA.x, z: S.antA.z, r: 4 } })}
      {one("snail", "snail", { shy: "none" })}
      {one("firefly", "firefly", {
        ground: undefined,
        clipMap: { move: "fly" },
        glow,
        children: <pointLight ref={(l) => (light.current = l)} color="#d8ff6a" intensity={0.2} distance={3} decay={2} position={[0, 0.2, -0.1]} />,
      })}
      {stick && one("stick", "stick-insect", { url: stick.camoModelUrl || stick.modelUrl, shy: "none" })}
    </>
  );
}

export type { Brain };
