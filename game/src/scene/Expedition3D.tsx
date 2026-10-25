// The first expedition in the Idea Grove: the Grove Keeper by the Idea Tree, the three glowing seeds of
// "Three sparks", and the tree frog sitting on the Biome Frontier stall (the "Your first photo" cameo).
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { BlockProps, ExpeditionProps } from "../block";
import type { Game, Target } from "../game/state";
import { useExp } from "../game/expedition";
import { currentStep } from "../game/quests";
import { FROG_CAMEO, KEEPER, PLAZA_TOP, SPARKS, STALLS, stallPoint, groundY } from "../game/layout";
import { glowTexture, useModel } from "./assets";
import { Creature, newBrain, restore, setBehaviour, Animate, Think } from "./creatures";
import { GroveInsects } from "./Insects";

/** The keeper's look when he is drawn with the explorers' base model (no model of his own yet). */
const KEEPER_TINT: Record<string, string> = { skin: "#d9a57a", hair: "#e8e4dc", shirt: "#5f7d3a", pants: "#7a6046", shoes: "#4a3424", bag: "#a8743a" };

function KeeperBody({ url, tinted, game }: { url: string; tinted: boolean; game: Game }) {
  const gltf = useModel(url);
  const { obj, mixer, actions } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      if (tinted) {
        const list = Array.isArray(m.material) ? m.material : [m.material];
        const cl = list.map((x) => {
          const c = (x as THREE.MeshStandardMaterial).clone();
          if (KEEPER_TINT[c.name]) c.color.set(KEEPER_TINT[c.name]);
          return c;
        });
        m.material = Array.isArray(m.material) ? cl : cl[0];
      }
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
    if (actions.idle) actions.idle.play();
    return { obj, mixer, actions };
  }, [gltf, tinted]);
  const cur = useRef("idle");
  const group = useRef<THREE.Group>(null);
  const waved = useRef(0);
  useFrame((_, dt) => {
    const st = useExp.getState();
    const line = st.dialogue ? st.dialogue.lines[st.dialogue.index] : null;
    const near = Math.hypot(game.me.x - KEEPER.x, game.me.z - KEEPER.z) < 4;
    const now = performance.now();
    if (near && now - waved.current > 15000 && !line) waved.current = now;
    let want = line ? line.anim || "talk" : now - waved.current < 1600 ? "wave" : "idle";
    if (!actions[want]) want = "idle";
    if (want !== cur.current && actions[want]) {
      const next = actions[want];
      next.reset().play();
      if (want === "wave") {
        next.setLoop(THREE.LoopRepeat, Infinity);
      }
      const prev = actions[cur.current];
      if (prev && prev !== next) prev.crossFadeTo(next, 0.25, false);
      cur.current = want;
    }
    mixer.update(Math.min(dt, 0.1));
    // talking: a gentle nod (works with any model)
    const g = group.current;
    if (g) g.rotation.x = line ? Math.sin(now / 160) * 0.025 : 0;
    // turn toward the explorer when he is close
    if (g && near) {
      const a = Math.atan2(game.me.x - KEEPER.x, game.me.z - KEEPER.z) - KEEPER.ry;
      g.rotation.y += (Math.atan2(Math.sin(a), Math.cos(a)) - g.rotation.y) * Math.min(1, dt * 3);
    } else if (g) g.rotation.y *= 1 - Math.min(1, dt * 2);
  });
  return (
    <group ref={group}>
      <primitive object={obj} />
    </group>
  );
}

function Keeper({ props, exp, game }: { props: BlockProps; exp: ExpeditionProps; game: Game }) {
  const url = exp.keeper.modelUrl || props.models.avatar;
  return (
    <group
      position={[KEEPER.x, PLAZA_TOP, KEEPER.z]}
      rotation-y={KEEPER.ry}
      scale={exp.keeper.modelUrl ? 1 : 1.12}
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "exp-keeper", kind: "keeper", ref: "keeper", x: KEEPER.x, z: KEEPER.z, reach: 2.6 } }));
      }}
    >
      <KeeperBody url={url} tinted={!exp.keeper.modelUrl} game={game} />
      {/* an easy tap area */}
      <mesh position={[0, 0.9, 0]} visible={false}>
        <cylinderGeometry args={[0.6, 0.6, 1.9, 8]} />
        <meshBasicMaterial />
      </mesh>
      <QuestMark />
    </group>
  );
}

/** A glowing "!" over the keeper while a talk step waits for the explorer. */
function QuestMark() {
  const ref = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffd25a";
    g.strokeStyle = "#7a4a12";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#5a3416";
    g.font = "bold 84px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("!", 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const st = useExp.getState();
    const step = st.quests ? currentStep(st.quests, st.save) : null;
    s.visible = !!step && step.kind === "talk" && step.target === "keeper" && !st.dialogue;
    s.position.y = 2.35 + Math.sin(performance.now() / 300) * 0.06;
  });
  return (
    <sprite ref={ref} position={[0, 2.35, 0]} scale={[0.5, 0.5, 1]} visible={false}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

/** The glowing seed: its halo (node spark_glow) breathes, and its core and veins pulse with light. */
function SparkModel({ url, index }: { url: string; index: number }) {
  const gltf = useModel(url);
  const { obj, halo, glowMats, emissive } = useMemo(() => {
    const obj = gltf.scene.clone(true);
    const halo = obj.getObjectByName("spark_glow") || null;
    const glowMats: THREE.MeshStandardMaterial[] = [];
    const emissive: { m: THREE.MeshStandardMaterial; base: number }[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
      let inHalo = false;
      for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === halo) inHalo = true;
      if (inHalo || mat.name === "spark_glow") {
        // the halo is a soft additive shell (the loader turned blended materials into cut-outs)
        mat.transparent = true;
        mat.alphaTest = 0;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;
        glowMats.push(mat);
      } else if (/spark_core|spark_vein/.test(mat.name) && mat.emissive) emissive.push({ m: mat, base: Math.max(0.6, mat.emissiveIntensity || 1) });
    });
    return { obj, halo, glowMats, emissive };
  }, [gltf]);
  useFrame(() => {
    const t = performance.now() / 1000 + index * 0.7;
    const k = 0.5 + 0.5 * Math.sin(t * 3.2);
    if (halo) halo.scale.setScalar(0.9 + k * 0.35);
    for (const m of glowMats) m.opacity = 0.35 + k * 0.55;
    for (const e of emissive) e.m.emissiveIntensity = e.base * (0.7 + k * 1.1);
  });
  return <primitive object={obj} />;
}

function Spark({ spot, url, index }: { spot: (typeof SPARKS)[number]; url: string; index: number }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const y0 = groundY(spot.x, spot.z);
  useFrame(() => {
    const t = performance.now() / 1000 + index;
    if (g.current) {
      g.current.position.y = y0 + 0.75 + Math.sin(t * 1.8) * 0.12;
      g.current.rotation.y = t * 0.8;
    }
    if (ring.current) {
      const k = (t * 0.6) % 1;
      ring.current.scale.setScalar(0.5 + k * 1.3);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
  });
  return (
    <group
      position={[spot.x, 0, spot.z]}
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "exp-" + spot.id, kind: "spark", ref: spot.id, x: spot.x, z: spot.z, reach: 2.4 } }));
      }}
    >
      <group ref={g}>
        {url ? (
          <React.Suspense fallback={null}>
            <SparkModel url={url} index={index} />
          </React.Suspense>
        ) : null}
        <sprite scale={[1.5, 1.5, 1]} renderOrder={7}>
          <spriteMaterial map={glowTexture()} color="#ffe48a" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <sprite scale={[0.45, 0.45, 1]} renderOrder={8}>
          <spriteMaterial map={glowTexture()} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <pointLight color="#ffd27a" intensity={2.2} distance={4.5} decay={2} />
      </group>
      <mesh ref={ring} position={[0, y0 + 0.04, 0]} rotation-x={-Math.PI / 2} renderOrder={5}>
        <ringGeometry args={[0.55, 0.7, 32]} />
        <meshBasicMaterial color="#ffe3a0" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* an easy, generous tap area */}
      <mesh position={[0, y0 + 0.8, 0]} visible={false}>
        <cylinderGeometry args={[0.8, 0.8, 1.8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

const frogStill: Think = (b) => {
  if (b.left > 0) return;
  const r = Math.random();
  setBehaviour(b, r < 0.35 ? "feed" : r < 0.55 ? "special" : "idle", r < 0.55 ? 1.2 : 2 + Math.random() * 3);
};

const frogCameoAnim: Animate = (parts, rest, b, time) => {
  for (const n of Object.keys(rest)) restore(parts[n], rest[n]);
  const body = parts["frog_body"];
  if (b.behaviour === "feed") for (const n of ["frog_head", "frog_eye0", "frog_eye1", "frog_pupil0", "frog_pupil1", "frog_shine0", "frog_shine1"]) if (parts[n]) parts[n].position.z += Math.max(0, Math.sin(Math.min(1, b.t / 0.5) * Math.PI)) * 0.05;
  if (b.behaviour === "special" && body) body.scale.x *= 1 + Math.abs(Math.sin(time * 9)) * 0.12; // calling
  else if (body) body.scale.y *= 1 + Math.sin(time * 3) * 0.025;
};

/** The tree frog sitting on the Biome Frontier stall (from the "Your first photo" quest on). */
function FrogCameo({ exp, game }: { exp: ExpeditionProps; game: Game }) {
  const frog = exp.species.find((s) => s.id === "tree-frog");
  const st = STALLS.find((s) => s.key === "biome")!;
  const brain = useMemo(() => {
    const p = stallPoint(st, FROG_CAMEO.lx, FROG_CAMEO.lz);
    return newBrain(p.x, FROG_CAMEO.y, p.z, st.ry);
  }, [st]);
  if (!frog) return null;
  return <Creature id="grove-frog" species="tree-frog" url={frog.modelUrl} icon={frog.icon} scale={(frog.scale || 1) * 0.9} game={game} brain={brain} think={frogStill} animate={frogCameoAnim} shy="none" />;
}

/** Everything of the expedition that lives in the Idea Grove. */
export function GroveExpedition({ props, exp, game }: { props: BlockProps; exp: ExpeditionProps; game: Game }) {
  const save = useExp((s) => s.save);
  const quests = useExp((s) => s.quests);
  const step = quests ? currentStep(quests, save) : null;
  const sparksOn = !!step && step.kind === "find" && step.target === "spark";
  const left = SPARKS.filter((s) => sparksOn && save.p.indexOf(s.id) < 0);
  const frogOn = save.started && save.q >= 1;
  // the keeper and the seeds are things to use: the HUD's action button reaches them too
  useEffect(() => {
    const own: Target[] = [{ key: "exp-keeper", kind: "keeper", ref: "keeper", x: KEEPER.x, z: KEEPER.z, reach: 2.6 }];
    for (const s of left) own.push({ key: "exp-" + s.id, kind: "spark", ref: s.id, x: s.x, z: s.z, reach: 2.4 });
    const add = () => {
      game.targets = game.targets.filter((t) => t.key.indexOf("exp-") !== 0).concat(own);
    };
    add();
    // the grove's own targets may be (re)set after this effect: add ours again shortly after
    const id = window.setTimeout(add, 400);
    return () => {
      window.clearTimeout(id);
      game.targets = game.targets.filter((t) => t.key.indexOf("exp-") !== 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, left.map((s) => s.id).join(",")]);
  return (
    <>
      <Keeper props={props} exp={exp} game={game} />
      {left.map((s) => (
        <Spark key={s.id} spot={s} url={exp.models.spark} index={SPARKS.indexOf(s)} />
      ))}
      {frogOn && <FrogCameo exp={exp} game={game} />}
      <GroveInsects exp={exp} game={game} />
    </>
  );
}
