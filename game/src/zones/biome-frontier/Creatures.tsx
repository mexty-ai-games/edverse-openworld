// The Biome Frontier's living creatures, each with its real habits (a small behaviour brain per species):
// the toucan hops, pecks fruit and makes short flights between perches; the tree frog sits and hops by the
// water; the blue morpho flutters and lands to drink fruit juice; the sloth hangs and moves very slowly;
// the desert tortoise walks slowly and feeds; the horned lizard scuttles and basks in a sun spot; the
// bighorn grazes and climbs a rock; the saguaro is in flower; the sea turtle swims, grazes and comes up to
// breathe; the clownfish stays by its anemone; the sea star crawls on a pier post; the octopus hides in its
// den, peeks out and changes colour. Rushing at them makes them flee for a moment.
import React, { useMemo } from "react";
import * as THREE from "three";
import type { GuideSpecies } from "../../block";
import type { Game } from "../../game/state";
import { Animate, Brain, Creature, newBrain, restore, setBehaviour, Think, turnTo, walkTo } from "../../scene/creatures";
import { CREATURES, TREES } from "./layout";
import { useModel } from "../../scene/assets";
import { groundY, landHeight } from "./layout";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A point within r of (x, z). */
function near(x: number, z: number, r: number) {
  const a = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * r;
  return { x: x + Math.sin(a) * d, z: z + Math.cos(a) * d };
}

// ------------------------------------------------------------------ brains
function toucanThink(perches: { x: number; y: number; z: number }[]): Think {
  let from = 0;
  let to = 0;
  return (b, dt) => {
    if (b.behaviour === "special") {
      // a short flight on a low arc to the next perch
      const k = Math.min(1, b.t / 2.4);
      const p0 = perches[from];
      const p1 = perches[to];
      b.x = p0.x + (p1.x - p0.x) * k;
      b.z = p0.z + (p1.z - p0.z) * k;
      b.y = p0.y + (p1.y - p0.y) * k + Math.sin(k * Math.PI) * 1.6;
      turnTo(b, Math.atan2(p1.x - p0.x, p1.z - p0.z), dt * 8);
      if (k >= 1) setBehaviour(b, "idle", rnd(2, 4));
      return;
    }
    if (b.left > 0) return;
    if (b.behaviour === "idle" && Math.random() < 0.55) setBehaviour(b, "feed", rnd(3, 4.5));
    else if (b.behaviour === "move" || Math.random() < 0.5) {
      from = to;
      to = (to + 1 + Math.floor(Math.random() * (perches.length - 1))) % perches.length;
      setBehaviour(b, "special", 2.4);
    } else {
      // a little hop round on its perch
      setBehaviour(b, "move", 0.5);
      b.ry += rnd(-1.2, 1.2);
    }
  };
}

const toucanAnim: Animate = (parts, rest, b, time) => {
  const flap = b.behaviour === "special" ? Math.sin(time * 22) * 0.9 : 0;
  for (const [n, side] of [["toucan_wing-1", -1], ["toucan_wing1", 1]] as [string, number][]) {
    const w = parts[n];
    restore(w, rest[n]);
    if (w) w.rotation.z += flap * side;
  }
  const root = parts["toucan"];
  restore(root, rest["toucan"]);
  if (root) {
    if (b.behaviour === "feed") root.rotation.x += Math.max(0, Math.sin(time * 7)) * 0.45;
    if (b.behaviour === "move") root.position.y += Math.abs(Math.sin(b.t * Math.PI * 2)) * 0.12;
  }
  const perch = parts["toucan_perch"];
  if (perch) perch.visible = false;
};

function frogThink(home: { x: number; z: number }): Think {
  return (b, dt) => {
    if (b.behaviour === "move") {
      // one hop: up and along
      const k = Math.min(1, b.t / 0.55);
      turnTo(b, Math.atan2(b.ax - b.x, b.az - b.z), dt * 12);
      b.x += (b.ax - b.x) * Math.min(1, dt * 3.5);
      b.z += (b.az - b.z) * Math.min(1, dt * 3.5);
      b.y = groundY(b.x, b.z) + Math.sin(k * Math.PI) * 0.35;
      if (k >= 1) setBehaviour(b, "idle", rnd(2.5, 5));
      return;
    }
    b.y = groundY(b.x, b.z);
    if (b.left > 0) return;
    const r = Math.random();
    if (r < 0.35) setBehaviour(b, "feed", 1.3);
    else if (r < 0.6) setBehaviour(b, "special", 2.2); // calling: its throat puffs out
    else {
      const p = near(home.x, home.z, 1.8);
      b.ax = p.x;
      b.az = p.z;
      setBehaviour(b, "move", 0.6);
    }
  };
}

const frogAnim: Animate = (parts, rest, b, time) => {
  const body = parts["frog_body"];
  for (const n of Object.keys(rest)) restore(parts[n], rest[n]);
  if (b.behaviour === "feed" && body) {
    const k = Math.max(0, Math.sin(Math.min(1, b.t / 0.5) * Math.PI));
    for (const n of ["frog_head", "frog_eye0", "frog_eye1", "frog_pupil0", "frog_pupil1", "frog_shine0", "frog_shine1"]) if (parts[n]) parts[n].position.z += k * 0.05;
  }
  if (b.behaviour === "move") for (const n of ["frog_back-1", "frog_back1"]) if (parts[n]) parts[n].rotation.x += Math.sin(Math.min(1, b.t / 0.55) * Math.PI) * 0.9;
  if (b.behaviour === "special" && body) body.scale.x *= 1 + Math.abs(Math.sin(time * 9)) * 0.12; // calling
  if (b.behaviour === "idle" && body) body.scale.y *= 1 + Math.sin(time * 3) * 0.025; // breathing
};

function morphoThink(spots: { x: number; y: number; z: number; fruit?: boolean }[]): Think {
  let at = 0;
  return (b, dt, time) => {
    if (b.behaviour === "special") {
      b.y += (spots[at].y + 0.6 + Math.sin(time * 2.6) * 0.3 - b.y) * Math.min(1, dt * 2);
      if (walkTo(b, dt, 1.4, 4) && b.t > 2.5) {
        b.y = spots[at].y;
        setBehaviour(b, spots[at].fruit ? "feed" : "idle", spots[at].fruit ? rnd(4, 6) : rnd(2, 4));
      }
      return;
    }
    b.y += (spots[at].y - b.y) * Math.min(1, dt * 4);
    if (b.left > 0) return;
    at = (at + 1 + Math.floor(Math.random() * (spots.length - 1))) % spots.length;
    b.ax = spots[at].x;
    b.az = spots[at].z;
    setBehaviour(b, "special", 4);
  };
}

const morphoAnim: Animate = (parts, rest, b, time) => {
  // flutter fast in flight; slow open and close while drinking; still at rest
  const k = b.behaviour === "special" ? 0.3 + 0.7 * Math.abs(Math.cos(time * 9)) : b.behaviour === "feed" ? 0.55 + 0.45 * Math.abs(Math.cos(time * 1.5)) : 0.9;
  for (const n of Object.keys(parts)) if (/morpho_wing/.test(n)) {
    restore(parts[n], rest[n]);
    parts[n].scale.x = rest[n].s.x * k;
  }
};

/** The sloth hangs from its branch: long rests, slow leaf chewing, a slow climb on the spot, now and then a slow wave. */
const slothThink: Think = (b, dt, time) => {
  b.ry += Math.sin(time * 0.3) * 0.0004;
  if (b.left > 0) return;
  const r = Math.random();
  setBehaviour(b, r < 0.4 ? "feed" : r < 0.7 ? "move" : r < 0.85 ? "special" : "idle", r < 0.85 ? rnd(6, 10) : rnd(8, 14));
};

function walkerThink(home: { x: number; z: number }, r: number, speed: number, special: number, ground = groundY): Think {
  return (b, dt) => {
    b.y = ground(b.x, b.z);
    if (b.behaviour === "move") {
      if (walkTo(b, dt, speed, 2.5) || b.left <= 0) setBehaviour(b, Math.random() < 0.6 ? "feed" : "idle", rnd(3, 6));
      return;
    }
    if (b.left > 0) return;
    const roll = Math.random();
    if (roll < special) setBehaviour(b, "special", rnd(4, 6));
    else {
      const p = near(home.x, home.z, r);
      b.ax = p.x;
      b.az = p.z;
      setBehaviour(b, "move", 14);
    }
  };
}

const tortoiseAnim: Animate = (parts, rest, b, time) => {
  for (const n of Object.keys(rest)) restore(parts[n], rest[n]);
  const tucked = b.behaviour === "special" || b.behaviour === "hide" || b.behaviour === "flee";
  const head = ["tortoise_head", "tortoise_neck", "tortoise_eye0", "tortoise_eye1", "tortoise_pupil0", "tortoise_pupil1"];
  if (tucked) {
    for (const n of head) if (parts[n]) parts[n].position.z -= 0.16;
    for (const n of Object.keys(parts)) if (/tortoise_leg/.test(n)) parts[n].scale.multiplyScalar(0.55);
  } else if (b.behaviour === "feed") {
    for (const n of head) if (parts[n]) {
      parts[n].position.y -= 0.05 + Math.max(0, Math.sin(time * 3)) * 0.03;
      parts[n].position.z += 0.03;
    }
  } else if (b.behaviour === "move") {
    let i = 0;
    for (const n of Object.keys(parts)) if (/tortoise_leg/.test(n)) parts[n].rotation.x += Math.sin(time * 4 + (i++ % 2) * Math.PI) * 0.35;
  }
};

function lizardThink(home: { x: number; z: number }, sun: { x: number; y: number; z: number }): Think {
  return (b, dt) => {
    if (b.behaviour === "move") {
      // short, quick dashes
      const done = walkTo(b, dt, 2.6, 14);
      b.y = b.i === 1 ? sun.y : groundY(b.x, b.z);
      if (done || b.left <= 0) setBehaviour(b, b.i === 1 ? "special" : Math.random() < 0.5 ? "feed" : "idle", b.i === 1 ? rnd(6, 9) : rnd(1.5, 3));
      return;
    }
    if (b.left > 0) return;
    if (b.behaviour !== "special" && Math.random() < 0.35) {
      b.i = 1;
      b.ax = sun.x;
      b.az = sun.z;
    } else {
      b.i = 0;
      const p = near(home.x, home.z, 2.2);
      b.ax = p.x;
      b.az = p.z;
    }
    setBehaviour(b, "move", 3);
  };
}

const lizardAnim: Animate = (parts, rest, b, time) => {
  for (const n of Object.keys(rest)) restore(parts[n], rest[n]);
  const root = parts["horned_lizard"];
  if (b.behaviour === "special" && root) root.scale.y *= 0.8; // flattened against the warm rock
  if (b.behaviour === "feed" && parts["lizard_head"]) parts["lizard_head"].rotation.x += Math.max(0, Math.sin(time * 9)) * 0.3;
  if (b.behaviour === "move") for (const n of Object.keys(parts)) if (/lizard_leg/.test(n)) parts[n].rotation.y += Math.sin(time * 24 + (n.indexOf("-1") > 0 ? Math.PI : 0)) * 0.5;
};

function bighornThink(home: { x: number; z: number }, rock: { x: number; y: number; z: number }): Think {
  const base = walkerThink(home, 2.5, 0.7, 0);
  return (b, dt, time) => {
    if (b.behaviour === "special") {
      // climb the rock, stand, come down
      if (b.i === 0) {
        b.ax = rock.x;
        b.az = rock.z;
        walkTo(b, dt, 0.9, 3);
        const d = Math.hypot(rock.x - b.x, rock.z - b.z);
        b.y = groundY(b.x, b.z) + Math.max(0, 1 - d / 1.4) * rock.y;
        if (d < 0.1) b.i = 1;
      } else if (b.left <= 0) {
        b.i = 0;
        const p = near(home.x, home.z, 1.5);
        b.ax = p.x;
        b.az = p.z;
        setBehaviour(b, "move", 10);
      }
      return;
    }
    if (b.behaviour !== "move" && b.left <= 0 && Math.random() < 0.3) {
      b.i = 0;
      setBehaviour(b, "special", 9);
      return;
    }
    base(b, dt, time);
  };
}

function turtleThink(home: { x: number; z: number }): Think {
  let a = 0;
  return (b, dt, time) => {
    const swimY = -0.75;
    if (b.behaviour === "idle" || b.behaviour === "move") {
      a += dt * 0.12;
      b.x = home.x + Math.cos(a) * 3.5;
      b.z = home.z + Math.sin(a) * 3.5;
      b.ry = -a + Math.PI;
      b.y += (swimY + Math.sin(time * 0.8) * 0.06 - b.y) * Math.min(1, dt * 2);
      b.behaviour = "move";
      if (b.left <= 0) setBehaviour(b, Math.random() < 0.5 ? "special" : "feed", rnd(4, 5));
      return;
    }
    const want = b.behaviour === "special" ? -0.22 : landHeight(b.x, b.z) + 0.25;
    b.y += (want - b.y) * Math.min(1, dt * 1.2);
    if (b.left <= 0) setBehaviour(b, "move", rnd(9, 14));
  };
}

const turtleAnim: Animate = (parts, rest, b, time) => {
  const k = b.behaviour === "feed" ? 0.25 : 1;
  for (const [n, ph] of [["turtle_flipper_f-1", 0], ["turtle_flipper_f1", 0], ["turtle_flipper_b-1", 1], ["turtle_flipper_b1", 1]] as [string, number][]) {
    restore(parts[n], rest[n]);
    if (parts[n]) parts[n].rotation.z += Math.sin(time * 2.2 + ph) * 0.45 * k * (n.indexOf("-1") > 0 ? -1 : 1);
  }
};

function clownThink(home: { x: number; z: number }, y: number): Think {
  let a = 0;
  return (b, dt, time) => {
    const r = b.behaviour === "special" ? 0.05 : 0.32;
    a += dt * (b.behaviour === "feed" ? 1.6 : 0.9);
    b.x = home.x + Math.cos(a) * r;
    b.z = home.z + Math.sin(a) * r;
    b.ry = -a;
    b.y = y + 0.2 + (b.behaviour === "special" ? -0.12 : Math.sin(time * 2) * 0.04);
    clownTimer(b);
  };
}

const clownTimer = (b: Brain) => {
  if (b.left > 0) return;
  const r = Math.random();
  setBehaviour(b, r < 0.3 ? "feed" : r < 0.6 ? "special" : "idle", rnd(3, 5));
};

const clownAnim: Animate = (parts, rest, b, time) => {
  // the fish swims round its anemone (the anemone stays put); it dips into it to hide
  const a = time * 0.9;
  const dx = Math.cos(a) * 0.16;
  const dz = Math.sin(a) * 0.16;
  const dy = b.behaviour === "special" ? -0.12 : b.behaviour === "feed" ? Math.sin(time * 6) * 0.05 : 0;
  for (const n of Object.keys(rest)) if (/^clownfish_/.test(n)) {
    restore(parts[n], rest[n]);
    parts[n].position.x += dx;
    parts[n].position.z += dz;
    parts[n].position.y += dy;
  }
  if (parts["clownfish_tail"]) parts["clownfish_tail"].rotation.y += Math.sin(time * 14) * 0.35;
};

function seaStarThink(post: { x: number; z: number; top: number; bottom: number }): Think {
  return (b, dt) => {
    if (b.behaviour === "move") {
      const tgt = b.i ? post.top : post.bottom;
      b.y += Math.sign(tgt - b.y) * Math.min(Math.abs(tgt - b.y), 0.05 * dt);
      if (Math.abs(tgt - b.y) < 0.01) {
        b.i = b.i ? 0 : 1;
        setBehaviour(b, b.i ? "idle" : "feed", rnd(6, 9));
      }
      return;
    }
    if (b.left <= 0) setBehaviour(b, "move", 60);
  };
}

function octopusThink(): Think {
  return (b) => {
    if (b.left > 0) return;
    const r = Math.random();
    setBehaviour(b, r < 0.45 ? "feed" : r < 0.75 ? "special" : "idle", rnd(4, 7));
  };
}

/** The octopus peeks out of its den (feed), hides inside (idle) and changes colour (special). */
function octopusPaint(body: THREE.Object3D, b: Brain, time: number) {
  const out = b.behaviour === "feed" || b.behaviour === "special" ? 1 : 0.35;
  body.position.y += (out * 0.25 - 0.1 - body.position.y) * 0.05;
  const c = new THREE.Color();
  if (b.behaviour === "special") c.setHSL((0.02 + Math.sin(time * 1.5) * 0.04 + 1) % 1, 0.7, 0.5 + Math.sin(time * 3) * 0.12);
  else c.set("#ffffff");
  let skin = false;
  body.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && m.name === "octopus_skin") skin = true;
  });
  body.traverse((o) => {
    const m = (o as THREE.Mesh | THREE.Sprite).material as THREE.MeshStandardMaterial | THREE.SpriteMaterial | undefined;
    if (!m || !(m as THREE.MeshStandardMaterial).color || (skin && m.name !== "octopus_skin")) return;
    const ud = m.userData as { owBase?: THREE.Color };
    if (!ud.owBase) ud.owBase = (m as THREE.MeshStandardMaterial).color.clone();
    (m as THREE.MeshStandardMaterial).color.copy(ud.owBase).multiply(c);
  });
}

/** The saguaro in flower: its flower nodes show (the others in the canyon are not flowering). */
const saguaroAnim: Animate = (parts) => {
  for (const n of Object.keys(parts)) if (/saguaro_flower/.test(n)) parts[n].visible = true;
};

// ------------------------------------------------------------------ the cast
/** The sloth's branch, beside the big rainforest tree nearest its spot (the branch reaches out from the trunk). */
const slothSpot = (() => {
  const want = CREATURES.sloth[0];
  let best = TREES[0];
  for (const tr of TREES) if (Math.hypot(tr.x - want.x, tr.z - want.z) < Math.hypot(best.x - want.x, best.z - want.z)) best = tr;
  // out from the trunk toward the trail (east), the branch's X axis pointing back at the trunk
  const dx = 1.0;
  const dz = 0.35;
  const l = Math.hypot(dx, dz);
  const off = 1.1 * (best.s || 1);
  return { x: best.x + (dx / l) * off, z: best.z + (dz / l) * off, y: want.y, ry: Math.atan2(dz, -dx) + Math.PI / 2 };
})();

/** The clownfish's sea anemone (from the district's own clownfish model), fixed on the reef. */
function Anemone({ url, x, z }: { url: string; x: number; z: number }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName("anemone");
    const g = new THREE.Group();
    if (src) {
      const c = src.clone(true);
      g.add(c);
    }
    return g;
  }, [gltf]);
  return <primitive object={obj} position={[x, landHeight(x, z), z]} scale={1.5} />;
}

export function Creatures({ species, game, anemoneUrl }: { species: GuideSpecies[]; game: Game; anemoneUrl?: string }) {
  const by = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of species) m[s.id] = s;
    return m;
  }, [species]);
  const C = CREATURES;
  const cast = useMemo(() => {
    const b = (x: number, z: number, y?: number, ry = 0) => newBrain(x, y == null ? groundY(x, z) : y, z, ry);
    return {
      toucan: { brain: b(C.toucanPerches[0].x, C.toucanPerches[0].z, C.toucanPerches[0].y, 0.6), think: toucanThink(C.toucanPerches) },
      frog: { brain: b(C.frog.x, C.frog.z), think: frogThink(C.frog) },
      morpho: { brain: b(C.morphoSpots[0].x, C.morphoSpots[0].z, C.morphoSpots[0].y), think: morphoThink(C.morphoSpots) },
      sloth: { brain: b(slothSpot.x, slothSpot.z, slothSpot.y, slothSpot.ry), think: slothThink },
      tortoise: { brain: b(C.tortoise.x, C.tortoise.z), think: walkerThink(C.tortoise, 2.6, 0.22, 0.25) },
      lizard: { brain: b(C.lizard.x, C.lizard.z), think: lizardThink(C.lizard, C.lizardSun) },
      bighorn: { brain: b(C.bighorn.x, C.bighorn.z), think: bighornThink(C.bighorn, C.bighornRock) },
      saguaro: { brain: b(C.saguaro.x, C.saguaro.z, landHeight(C.saguaro.x, C.saguaro.z) - 0.05, C.saguaro.ry), think: ((x: Brain) => { x.behaviour = "special"; }) as Think },
      turtle: { brain: b(C.turtle.x + 3.5, C.turtle.z, -0.75), think: turtleThink(C.turtle) },
      clown: { brain: b(C.clownfish.x, C.clownfish.z, landHeight(C.clownfish.x, C.clownfish.z)), think: clownThink(C.clownfish, landHeight(C.clownfish.x, C.clownfish.z)) },
      star: { brain: b(C.seaStar.x, C.seaStar.z, C.seaStar.bottom, C.seaStar.ry), think: seaStarThink(C.seaStar) },
      octopus: { brain: b(C.octopus.x, C.octopus.z, landHeight(C.octopus.x, C.octopus.z) + 0.05, 2.4), think: octopusThink() },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        ground={groundY}
        {...extra}
      />
    );
  };
  return (
    <>
      {one("toucan", "toucan", { animate: toucanAnim, home: { x: C.toucanPerches[0].x, z: C.toucanPerches[0].z, r: 30 }, ground: undefined })}
      {one("frog", "tree-frog", { animate: frogAnim, home: { x: C.frog.x, z: C.frog.z, r: 2 }, fleeSpeed: 2.2 })}
      {one("morpho", "morpho", { animate: morphoAnim, ground: undefined, home: { x: C.morphoSpots[0].x, z: C.morphoSpots[0].z, r: 12 } })}
      {one("sloth", "sloth", { ground: undefined, fleeSpeed: 0.25, home: { x: C.sloth[0].x, z: C.sloth[0].z, r: 1 } })}
      {one("tortoise", "tortoise", { animate: tortoiseAnim, fleeSpeed: 0.3, home: { x: C.tortoise.x, z: C.tortoise.z, r: 3 } })}
      {one("lizard", "horned-lizard", { animate: lizardAnim, fleeSpeed: 3.4, home: { x: C.lizard.x, z: C.lizard.z, r: 3 } })}
      {one("bighorn", "bighorn", { fleeSpeed: 2.6, home: { x: C.bighorn.x, z: C.bighorn.z, r: 4 } })}
      {one("saguaro", "saguaro", { animate: saguaroAnim, shy: "none", ground: undefined })}
      {one("turtle", "sea-turtle", { animate: turtleAnim, shy: "dive", ground: undefined })}
      {one("clown", "clownfish", { animate: clownAnim, shy: "dive", ground: undefined })}
      {anemoneUrl && by.clownfish && by.clownfish.modelUrl !== anemoneUrl && (
        <React.Suspense fallback={null}>
          <Anemone url={anemoneUrl} x={C.clownfish.x} z={C.clownfish.z} />
        </React.Suspense>
      )}
      {one("star", "sea-star", { shy: "none", ground: undefined, pitch: -Math.PI / 2 })}
      {one("octopus", "octopus", { shy: "dive", ground: undefined, paint: octopusPaint })}
    </>
  );
}

export { pick };
