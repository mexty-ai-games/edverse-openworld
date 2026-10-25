// Living creatures: one model per creature (its glb clips play when it has them, else its parts move
// procedurally), a small behaviour brain per species (written by each zone), shyness (an explorer who
// rushes straight at a creature makes it flee and hide for a moment) and the registry the Field Camera
// and the hand lens read (game.creatures).
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Game, LiveCreature } from "../game/state";
import { useExp } from "../game/expedition";
import { useModel } from "./assets";

/** A creature's mutable state, moved by its brain every frame. */
export interface Brain {
  x: number;
  y: number;
  z: number;
  ry: number;
  /** idle | move | feed | special (the brain's own) ; flee | hide (shyness) */
  behaviour: string;
  /** Seconds in the current behaviour. */
  t: number;
  /** Seconds left of the current behaviour (the brain's timer). */
  left: number;
  /** Free slots for the brain. */
  ax: number;
  az: number;
  i: number;
}

export type Think = (b: Brain, dt: number, time: number) => void;
/** Procedural motion of named parts (rest pose given), for models without clips. */
export type Animate = (parts: Record<string, THREE.Object3D>, rest: Record<string, { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }>, b: Brain, time: number) => void;

export function newBrain(x: number, y: number, z: number, ry = 0): Brain {
  return { x, y, z, ry, behaviour: "idle", t: 0, left: 1 + Math.random() * 2, ax: x, az: z, i: 0 };
}

export function setBehaviour(b: Brain, behaviour: string, seconds: number) {
  b.behaviour = behaviour;
  b.t = 0;
  b.left = seconds;
}

/** Turn toward an angle smoothly. */
export function turnTo(b: Brain, target: number, k: number) {
  let d = target - b.ry;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  b.ry += d * Math.min(1, k);
}

/** Walk toward (ax, az) at `speed`; true when there. Models face +Z. */
export function walkTo(b: Brain, dt: number, speed: number, turn = 6): boolean {
  const dx = b.ax - b.x;
  const dz = b.az - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.08) return true;
  turnTo(b, Math.atan2(dx, dz), dt * turn);
  const step = Math.min(d, speed * dt);
  b.x += (dx / d) * step;
  b.z += (dz / d) * step;
  return false;
}

const CLIPS: Record<string, string[]> = {
  idle: ["idle", "rest", "breathe"],
  move: ["walk", "move", "swim", "fly", "crawl", "hop", "climb"],
  feed: ["feed", "eat", "peck", "graze", "drink"],
  special: ["special", "call", "bask", "flower", "display"],
  flee: ["flee", "run", "fly", "swim", "walk", "hop"],
  hide: ["hide", "idle"],
};

let emojiCache: Record<string, THREE.Texture> = {};
function emojiTexture(icon: string): THREE.Texture {
  if (emojiCache[icon]) return emojiCache[icon];
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "100px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(icon, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  emojiCache[icon] = t;
  return t;
}

function ModelBody({ url, onReady }: { url: string; onReady: (o: THREE.Object3D, clips: THREE.AnimationClip[]) => void }) {
  const gltf = useModel(url);
  const obj = useMemo(() => cloneSkinned(gltf.scene) as THREE.Object3D, [gltf]);
  useEffect(() => onReady(obj, gltf.animations || []), [obj, gltf, onReady]);
  return <primitive object={obj} />;
}

/** Catches a creature model that fails to load: it shows as its icon instead of breaking the zone. */
class BodyGuard extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* shown as an icon */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let lastShyToast = 0;

export interface CreatureProps {
  id: string;
  species: string;
  url: string;
  icon: string;
  scale: number;
  game: Game;
  brain: Brain;
  think: Think;
  animate?: Animate;
  /** run (moves away) | dive (sinks / ducks away) | none (a plant) */
  shy?: "run" | "dive" | "none";
  /** Where it may flee to: it stays within this distance of its home point. */
  home?: { x: number; z: number; r: number };
  ground?: (x: number, z: number) => number;
  /** Metres per second when it flees (a sloth is slow). */
  fleeSpeed?: number;
  /** Tilt of the body (radians about X): a sea star on a post. */
  pitch?: number;
  /** Colour or visibility changes, every frame (the octopus changes colour). */
  paint?: (body: THREE.Object3D, b: Brain, time: number) => void;
  /** Extra objects drawn with it (an anemone, flowers...). */
  children?: React.ReactNode;
}

export function Creature({ id, species, url, icon, scale, game, brain, think, animate, shy = "run", home, ground, fleeSpeed = 3.2, pitch = 0, paint, children }: CreatureProps) {
  const body = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const st = useRef<{
    mixer: THREE.AnimationMixer | null;
    actions: Record<string, THREE.AnimationAction>;
    cur: THREE.AnimationAction | null;
    parts: Record<string, THREE.Object3D>;
    rest: Record<string, { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }>;
    prev: { x: number; z: number };
    seenAt: number;
    shy: number;
    hide: number;
    fx: number;
    fz: number;
  }>({ mixer: null, actions: {}, cur: null, parts: {}, rest: {}, prev: { x: game.me.x, z: game.me.z }, seenAt: 0, shy: 0, hide: 0, fx: 0, fz: 0 });
  const live = useMemo<LiveCreature>(() => ({ key: id, species, obj: new THREE.Object3D(), cy: 0.3 * scale, radius: 0.45 * scale, behaviour: "idle" }), [id, species, scale]);

  useEffect(() => {
    if (group.current) live.obj = group.current;
    game.creatures.push(live);
    return () => {
      game.creatures = game.creatures.filter((c) => c !== live);
    };
  }, [game, live]);

  const onReady = useMemo(
    () => (o: THREE.Object3D, clips: THREE.AnimationClip[]) => {
      const s = st.current;
      // bounding sphere (the model is unscaled here; the group carries the scale)
      const box = new THREE.Box3().setFromObject(o);
      if (!box.isEmpty()) {
        const sp = box.getBoundingSphere(new THREE.Sphere());
        live.cy = sp.center.y * scale;
        live.radius = Math.max(0.12, sp.radius * scale * 0.9);
      }
      s.parts = {};
      s.rest = {};
      o.traverse((c) => {
        if (c.name) {
          s.parts[c.name] = c;
          s.rest[c.name] = { p: c.position.clone(), r: c.rotation.clone(), s: c.scale.clone() };
        }
        const m = c as THREE.Mesh;
        if (m.isMesh) m.frustumCulled = false;
      });
      s.actions = {};
      s.cur = null;
      if (clips.length) {
        s.mixer = new THREE.AnimationMixer(o);
        for (const cl of clips) s.actions[cl.name.toLowerCase()] = s.mixer.clipAction(cl);
      } else s.mixer = null;
    },
    [live, scale],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const time = performance.now() / 1000;
    const b = brain;
    const s = st.current;
    const me = game.me;
    // shyness: the explorer rushing straight at it
    const vx = me.x - s.prev.x;
    const vz = me.z - s.prev.z;
    s.prev.x = me.x;
    s.prev.z = me.z;
    const dx = b.x - me.x;
    const dz = b.z - me.z;
    const dist = Math.hypot(dx, dz);
    const vl = Math.hypot(vx, vz);
    const toward = vl > 1e-4 && dist > 1e-3 ? (vx * dx + vz * dz) / (vl * dist) : 0;
    if (shy !== "none" && game.mode === "play" && b.behaviour !== "flee" && b.behaviour !== "hide") {
      s.shy = dist < 6 && game.speed > 3.2 && toward > 0.72 ? s.shy + dt : Math.max(0, s.shy - dt * 2);
      if (s.shy > 0.35) {
        s.shy = 0;
        s.fx = dx / Math.max(dist, 0.01);
        s.fz = dz / Math.max(dist, 0.01);
        setBehaviour(b, "flee", shy === "dive" ? 1.0 : 1.3);
        const now = Date.now();
        if (now - lastShyToast > 25000) {
          lastShyToast = now;
          const ex = useExp.getState();
          if (ex.save.tools.indexOf("camera") >= 0) window.dispatchEvent(new CustomEvent("ow-shy"));
        }
      }
    }
    b.t += dt;
    b.left -= dt;
    if (b.behaviour === "flee") {
      if (shy === "run") {
        let nx = b.x + s.fx * fleeSpeed * dt;
        let nz = b.z + s.fz * fleeSpeed * dt;
        if (home) {
          const hd = Math.hypot(nx - home.x, nz - home.z);
          if (hd > home.r + 3) {
            nx = b.x;
            nz = b.z;
          }
        }
        b.x = nx;
        b.z = nz;
        turnTo(b, Math.atan2(s.fx, s.fz), dt * 10);
        if (ground) b.y = ground(b.x, b.z);
      }
      if (b.left <= 0) setBehaviour(b, "hide", 3.5);
    } else if (b.behaviour === "hide") {
      if (b.left <= 0) setBehaviour(b, "idle", 1.5);
    } else think(b, dt, time);

    const g = group.current;
    if (g) {
      const dive = shy === "dive" && (b.behaviour === "flee" || b.behaviour === "hide") ? -0.45 * scale : 0;
      g.position.set(b.x, b.y, b.z);
      if (inner.current) inner.current.position.y += (dive - inner.current.position.y) * Math.min(1, dt * 4);
      g.rotation.y = b.ry;
      live.obj = g;
    }
    live.behaviour = b.behaviour;
    // clips (when the model has them), else the zone's procedural motion
    if (s.mixer) {
      const names = CLIPS[b.behaviour] || [b.behaviour];
      let next: THREE.AnimationAction | null = null;
      for (const n of [b.behaviour].concat(names)) if (s.actions[n]) {
        next = s.actions[n];
        break;
      }
      if (next && next !== s.cur) {
        next.reset().play();
        if (s.cur) s.cur.crossFadeTo(next, 0.3, false);
        s.cur = next;
      }
      s.mixer.update(dt);
    } else if (animate && Object.keys(s.parts).length) animate(s.parts, s.rest, b, time);
    if (paint && body.current) paint(body.current, b, time);
    // seen: close by and on screen
    if (time - s.seenAt > 0.6 && game.mode === "play" && dist < 10) {
      s.seenAt = time;
      const p = new THREE.Vector3(b.x, b.y + live.cy, b.z).project(camera);
      if (p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95) useExp.getState().seen(species);
    }
  });

  const icon3d = (
    <sprite position={[0, 0.45, 0]} scale={[0.9, 0.9, 1]}>
      <spriteMaterial map={emojiTexture(icon)} transparent depthWrite={false} />
    </sprite>
  );
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        useExp.getState().tapCreature(id, species);
      }}
    >
      <group ref={inner}>
        <group ref={body} scale={scale} rotation-x={pitch}>
          {url ? (
            <BodyGuard fallback={icon3d}>
              <React.Suspense fallback={null}>
                <ModelBody url={url} onReady={onReady} />
              </React.Suspense>
            </BodyGuard>
          ) : (
            icon3d
          )}
        </group>
        {children}
      </group>
      {/* a generous invisible tap area */}
      <mesh position={[0, live.cy, 0]} visible={false}>
        <sphereGeometry args={[Math.max(0.5, live.radius * 1.3), 8, 6]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

/** Rest pose helpers for procedural motion. */
export function restore(o: THREE.Object3D | undefined, r: { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 } | undefined) {
  if (!o || !r) return;
  o.position.copy(r.p);
  o.rotation.copy(r.r);
  o.scale.copy(r.s);
}

export function resetEmojiCache() {
  emojiCache = {};
}
