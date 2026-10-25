import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AvatarPreset, BlockProps, LocalizedText } from "../block";
import { Game, Peer, PHRASE_SECONDS } from "../game/state";
import * as GROVE from "../game/layout";
import type { Circle } from "../game/layout";
import { useModel } from "./assets";
import { pickLanguage, useLanguage } from "@mexty/sdk";

/** Where the explorer walks: the Idea Grove's layout, or the active district's (its own SPAWN, solids, ground and edge). */
export interface ZoneLayout {
  id: string;
  SPAWN: { x: number; y: number; z: number; ry: number };
  colliders: () => Circle[];
  groundY: (x: number, z: number) => number;
  WORLD_R: number;
}

export const GROVE_LAYOUT: ZoneLayout = { id: "idea-grove", SPAWN: GROVE.SPAWN, colliders: GROVE.colliders, groundY: GROVE.groundY, WORLD_R: GROVE.WORLD_R };

const TINTED = ["skin", "hair", "shirt", "pants", "shoes", "bag"] as const;
const EMOTE_MS: Record<string, number> = { wave: 1500, cheer: 1250 };

interface AnimState {
  moving: boolean;
  emote: string;
  emoteAt: number;
}

/** One explorer: the rigged base model, tinted with a preset, animated from its state. */
function Avatar({ url, preset, read }: { url: string; preset: AvatarPreset | undefined; read: () => AnimState }) {
  const gltf = useModel(url);
  const { obj, mixer, actions, mats } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    const mats: Record<string, THREE.MeshStandardMaterial[]> = {};
    obj.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = list.map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone();
        (mats[c.name] = mats[c.name] || []).push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? cloned : cloned[0];
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    for (const k of ["wave", "cheer"]) {
      if (actions[k]) {
        actions[k].setLoop(THREE.LoopOnce, 1);
        actions[k].clampWhenFinished = true;
      }
    }
    if (actions.idle) actions.idle.play();
    return { obj, mixer, actions, mats };
  }, [gltf]);
  useEffect(() => {
    if (!preset) return;
    for (const k of TINTED) {
      const c = (preset as unknown as Record<string, string>)[k];
      if (c) (mats[k] || []).forEach((m) => m.color.set(c));
    }
  }, [preset, mats]);
  const cur = useRef("idle");
  const started = useRef(0);
  useFrame((_, dt) => {
    const s = read();
    const now = performance.now();
    let want = s.moving ? "walk" : "idle";
    if (!s.moving && s.emote && now - s.emoteAt < (EMOTE_MS[s.emote] || 0)) want = s.emote;
    if (want !== cur.current || (EMOTE_MS[want] && started.current < s.emoteAt)) {
      const next = actions[want];
      const prev = actions[cur.current];
      if (next) {
        next.reset();
        next.play();
        if (prev && prev !== next) prev.crossFadeTo(next, 0.22, false);
        next.setEffectiveWeight(1);
      }
      cur.current = want;
      started.current = now;
    }
    mixer.update(Math.min(dt, 0.1));
  });
  return <primitive object={obj} />;
}

/** Nickname tag and phrase bubble above an explorer; updated without re-rendering. */
function Tag({ nick, read, phrases, mine, onTap, hidden }: {
  nick: string;
  read: () => { phrase: string | null; phraseAt: number };
  phrases: Record<string, { icon: string; text: LocalizedText }>;
  mine?: boolean;
  onTap?: () => void;
  hidden?: boolean;
}) {
  const bubble = useRef<HTMLDivElement>(null);
  const shown = useRef("");
  const { language, defaultLanguage } = useLanguage();
  useFrame(() => {
    const el = bubble.current;
    if (!el) return;
    const s = read();
    const live = !hidden && s.phrase && performance.now() - s.phraseAt < PHRASE_SECONDS * 1000 ? s.phrase : "";
    if (live === shown.current) return;
    shown.current = live;
    const ph = live ? phrases[live] : undefined;
    if (ph) {
      el.textContent = ph.icon + " " + pickLanguage(ph.text, language, defaultLanguage || "en");
      el.className = "ow-bubble on";
    } else el.className = "ow-bubble";
  });
  return (
    <Html position={[0, 1.5, 0]} center zIndexRange={[7, 0]} style={{ pointerEvents: "none" }}>
      <div className="ow-tagwrap">
        <div ref={bubble} className="ow-bubble" />
        <div
          className={"ow-tag" + (mine ? " mine" : "") + (hidden ? " muted" : "")}
          style={{ pointerEvents: onTap ? "auto" : "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (onTap) onTap();
          }}
        >
          {hidden ? "🙈 " : ""}
          {nick}
        </div>
      </div>
    </Html>
  );
}

function angleLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** The player's own explorer: movement, collisions, the 3/4 follow camera, the nearest thing to use. */
function Me({ props, game, phrases, layout }: { props: BlockProps; game: Game; phrases: Record<string, { icon: string; text: LocalizedText }>; layout: ZoneLayout }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const solid = useMemo(() => layout.colliders(), [layout]);
  const { SPAWN, WORLD_R, groundY } = layout;
  // a new zone: the camera jumps straight behind the explorer (the fade hides the cut)
  const snap = useRef(true);
  useEffect(() => {
    snap.current = true;
  }, [layout]);
  const look = useRef(new THREE.Vector3(0, 1, 0));
  const wantPos = useRef(new THREE.Vector3());
  const [, force] = useState(0);
  const avatarIdx = useRef(game.avatar);
  const nick = useRef(game.nickname);
  const mode = useRef(game.mode);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const me = game.me;
    if (avatarIdx.current !== game.avatar || nick.current !== game.nickname || mode.current !== game.mode) {
      avatarIdx.current = game.avatar;
      nick.current = game.nickname;
      mode.current = game.mode;
      force((n) => n + 1);
    }
    if (game.mode === "play") {
      let ix = game.input.x;
      let iz = game.input.z;
      if (ix || iz) game.walkTo = null;
      else if (game.walkTo) {
        const dx = game.walkTo.x - me.x;
        const dz = game.walkTo.z - me.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) game.walkTo = null;
        else {
          ix = dx / d;
          iz = dz / d;
        }
      }
      let len = Math.hypot(ix, iz);
      if (len > 1) {
        ix /= len;
        iz /= len;
        len = 1;
      }
      const speed = 4.6 * len;
      let nx = me.x + ix * speed * dt;
      let nz = me.z + iz * speed * dt;
      for (let pass = 0; pass < 2; pass++) {
        for (const c of solid) {
          const dx = nx - c.x;
          const dz = nz - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + 0.32;
          if (d < min && d > 1e-4) {
            nx = c.x + (dx / d) * min;
            nz = c.z + (dz / d) * min;
          }
        }
      }
      const r = Math.hypot(nx, nz);
      if (r > WORLD_R) {
        nx *= WORLD_R / r;
        nz *= WORLD_R / r;
      }
      const moved = Math.hypot(nx - me.x, nz - me.z);
      me.moving = len > 0.08 && moved > 0.2 * speed * dt;
      if (len > 0.08) me.ry = angleLerp(me.ry, Math.atan2(ix, iz), 1 - Math.exp(-dt * 12));
      me.x = nx;
      me.z = nz;
      if (game.walkTo && !me.moving) game.walkTo = null;
      // the nearest thing to look at or use
      let best = null;
      let bd = 1e9;
      for (const t of game.targets) {
        const d = Math.hypot(t.x - me.x, t.z - me.z);
        if (d < t.reach && d < bd) {
          bd = d;
          best = t;
        }
      }
      game.focus = best;
    } else {
      me.x = SPAWN.x;
      me.z = SPAWN.z;
      me.moving = false;
      me.ry = angleLerp(me.ry, 0, 1 - Math.exp(-dt * 6));
      game.focus = null;
    }
    me.y = groundY(me.x, me.z);
    const g = group.current;
    if (g) {
      g.position.set(me.x, me.y, me.z);
      g.rotation.y = me.ry;
    }
    // camera: close on the explorer at the start, then a 3/4 view from behind and above
    const portrait = size.height > size.width;
    if (game.mode === "play") {
      const k = portrait ? 1.35 : 1;
      wantPos.current.set(me.x, me.y + 5.4 * k, me.z + 8.2 * k);
      look.current.lerp(new THREE.Vector3(me.x, me.y + 1.5, me.z - 3.2), 1 - Math.exp(-dt * 6));
    } else {
      const side = portrait ? 0 : 0.85;
      wantPos.current.set(me.x + 0.4 + side, me.y + 1.35, me.z + (portrait ? 4.6 : 3.6));
      look.current.lerp(new THREE.Vector3(me.x + side, me.y + (portrait ? 0.45 : 0.85), me.z), 1 - Math.exp(-dt * 6));
    }
    if (snap.current && game.mode === "play") {
      snap.current = false;
      camera.position.copy(wantPos.current);
      look.current.set(me.x, me.y + 1.5, me.z - 3.2);
    } else camera.position.lerp(wantPos.current, 1 - Math.exp(-dt * (game.mode === "play" ? 4 : 3)));
    camera.lookAt(look.current);
  });
  return (
    <group ref={group}>
      <Avatar url={props.models.avatar} preset={props.avatars?.[game.avatar]} read={() => game.me} />
      {game.mode === "play" && <Tag nick={game.nickname} mine read={() => game.me} phrases={phrases} />}
    </group>
  );
}

function Remote({ peer, props, game, phrases, groundY, onTap }: {
  peer: Peer;
  props: BlockProps;
  game: Game;
  phrases: Record<string, { icon: string; text: LocalizedText }>;
  groundY: (x: number, z: number) => number;
  onTap: (peer: Peer) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hidden, setHidden] = useState(game.hidden.has(peer.id));
  const [av, setAv] = useState(peer.avatar);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-dt * 10);
    if (Math.hypot(peer.tx - peer.x, peer.tz - peer.z) > 8) {
      peer.x = peer.tx;
      peer.z = peer.tz;
    }
    peer.x += (peer.tx - peer.x) * k;
    peer.z += (peer.tz - peer.z) * k;
    peer.ry = angleLerp(peer.ry, peer.tr, k);
    const g = group.current;
    if (g) {
      g.position.set(peer.x, groundY(peer.x, peer.z), peer.z);
      g.rotation.y = peer.ry;
    }
    if (peer.avatar !== av) setAv(peer.avatar);
    // hidden from the report sheet (or shown again) without a re-render of the list
    if (game.hidden.has(peer.id) !== hidden) setHidden(game.hidden.has(peer.id));
  });
  return (
    <group ref={group}>
      {!hidden && <Avatar url={props.models.avatar} preset={props.avatars?.[av]} read={() => peer} />}
      <Tag nick={peer.nick} read={() => peer} phrases={phrases} onTap={() => onTap(peer)} hidden={hidden} />
    </group>
  );
}

/** Tapping another explorer's name tag opens the report / hide sheet (onPeerTap). */
export function Players({ props, game, layout = GROVE_LAYOUT, onPeerTap }: { props: BlockProps; game: Game; layout?: ZoneLayout; onPeerTap: (peer: Peer) => void }) {
  const phrases = useMemo(() => {
    const m: Record<string, { icon: string; text: LocalizedText }> = {};
    for (const p of props.phrases || []) m[p.id] = { icon: p.icon, text: p.text };
    return m;
  }, [props.phrases]);
  const [list, setList] = useState<Peer[]>([]);
  const ver = useRef("");
  useFrame(() => {
    const v = game.peerVersion + game.mode;
    if (ver.current !== v) {
      ver.current = v;
      setList(Array.from(game.peers.values()));
    }
  });
  return (
    <>
      <Me props={props} game={game} phrases={phrases} layout={layout} />
      {game.mode === "play" && list.map((p) => <Remote key={p.id} peer={p} props={props} game={game} phrases={phrases} groundY={layout.groundY} onTap={onPeerTap} />)}
    </>
  );
}
