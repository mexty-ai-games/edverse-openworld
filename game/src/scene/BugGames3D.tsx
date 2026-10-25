// The Bug Games arena in the Idea Grove's west meadow: grandstand, long-jump sand lane, weight-pull track,
// race lane, camouflage board, night box, podium and scoreboard. During an event the chosen athlete shows
// its real talent on its piece (its own animation clips, moved along the piece), the scoreboard writes the
// result in chalk, and at the end of a round the podium's leaf medal swings for the explorer's team.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { BugGamesProps, ExpeditionProps, GuideSpecies, T } from "../block";
import type { Game, Target } from "../game/state";
import { ARENA_PIECES, ArenaPiece } from "../game/layout";
import { PLAY_SECONDS, useGames } from "../game/bugGames";
import { needsLogin, useModel } from "./assets";
import { Brain, Creature, newBrain, setBehaviour, Think } from "./creatures";

const piece = (k: ArenaPiece["key"]) => ARENA_PIECES.find((p) => p.key === k)!;

/** Piece-local (x, z) to the world. */
export function pieceToWorld(p: ArenaPiece, lx: number, lz: number) {
  const c = Math.cos(p.ry);
  const s = Math.sin(p.ry);
  return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c };
}

/** Where the camera looks during an event on this piece, and how far from it. */
export function pieceView(key: string): { x: number; y: number; z: number; d: number; stand: { x: number; z: number } } {
  const k = (key === "dance" ? "dance" : key) as ArenaPiece["key"];
  const p = piece(k) || ARENA_PIECES[0];
  const lanes = key === "long_jump" || key === "weight_pull" || key === "race_lane";
  const d = lanes ? 3.4 : key === "hide_board" ? 2.4 : key === "night_box" ? 2.6 : key === "podium" ? 3.2 : 2.4;
  const y = key === "hide_board" ? 0.9 : key === "night_box" ? 0.9 : key === "podium" ? 1.0 : 0.35;
  // the explorer watches from the plaza side (east of the piece)
  const front = lanes ? { x: p.x + 4.2, z: p.z } : key === "podium" ? pieceToWorld(p, 1.45, 0.55) : pieceToWorld(p, 0, 3.4);
  return { x: p.x, y, z: p.z, d, stand: front };
}

function PieceModel({ url, p, children }: { url: string; p: ArenaPiece; children?: React.ReactNode }) {
  const gltf = useModel(url);
  const obj = useMemo(() => gltf.scene.clone(true), [gltf]);
  const nodes = useMemo(() => {
    const m: Record<string, THREE.Object3D> = {};
    obj.traverse((o) => {
      if (o.name) m[o.name] = o;
    });
    return m;
  }, [obj]);
  const rest = useMemo(() => {
    const r: Record<string, { z: number; rx: number; rz: number }> = {};
    for (const n of Object.keys(nodes)) r[n] = { z: nodes[n].position.z, rx: nodes[n].rotation.x, rz: nodes[n].rotation.z };
    return r;
  }, [nodes]);
  useFrame(() => {
    const now = performance.now();
    const g = useGames.getState();
    const play = g.play;
    const k = play ? Math.min(1, (now - play.at) / 1000 / PLAY_SECONDS) : 0;
    const time = now / 1000;
    if (p.key === "weight_pull") {
      // the sled slides along the rails as the athlete pulls
      const dist = play && play.event && pieceOf(play.event) === "weight_pull" ? pullDistance(play) * ease(Math.max(0, (k - 0.15) / 0.7)) : 0;
      for (const n of ["pull_sled", "pull_weights"]) if (nodes[n]) nodes[n].position.z = rest[n].z - dist;
    }
    if (p.key === "night_box" && nodes.night_box_lid) {
      const open = play && pieceOf(play.event) === "night_box" ? Math.min(1, k * 3) : 0;
      nodes.night_box_lid.rotation.x = rest.night_box_lid.rx - open * 1.7;
    }
    if (p.key === "grandstand" && nodes.grandstand_pennants) nodes.grandstand_pennants.rotation.z = rest.grandstand_pennants.rz + Math.sin(time * 1.3) * 0.01;
    if (p.key === "podium") {
      const pd = g.podium;
      const since = pd ? (now - pd.at) / 1000 : 99;
      for (const m of ["medal_gold", "medal_silver", "medal_bronze"]) {
        const o = nodes[m];
        if (!o) continue;
        const mine = pd && m === "medal_" + pd.medal;
        o.rotation.x = rest[m].rx + (mine ? Math.sin(since * 6) * 0.5 * Math.exp(-since * 0.4) : Math.sin(time * 1.1 + m.length) * 0.03);
      }
    }
  });
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.ry}>
      <primitive object={obj} />
      {children}
    </group>
  );
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Which arena piece an event uses (set by the panel when it starts a show). */
const EVENT_PIECE: Record<string, string> = {};
export function registerEventPieces(events: { id: string; piece: string }[]) {
  for (const e of events) EVENT_PIECE[e.id] = e.piece;
}
function pieceOf(event: string) {
  return EVENT_PIECE[event] || "";
}
function pullDistance(play: { ok: boolean; species: string }) {
  return play.ok ? 2.3 : play.species === "leafcutter-ant" ? 0.45 : 0.08;
}

// ------------------------------------------------------------------ the scoreboard (chalk on slate)
function drawBoard(ctx: CanvasRenderingContext2D, b: ReturnType<typeof useGames.getState>["board"], img: HTMLImageElement | null, title: string) {
  const W = 1024;
  const H = 512;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2f4a3c");
  g.addColorStop(1, "#22382d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // chalk dust
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect((i * 397) % W, (i * 211) % H, 2 + (i % 5), 1);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(240, 236, 220, 0.5)";
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.fillStyle = "#f4f1e6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fit = (s: string, size: number, maxW: number, weight = "800") => {
    let f = size;
    do {
      ctx.font = `${weight} ${f}px "Nunito", "Trebuchet MS", system-ui, sans-serif`;
      f -= 2;
    } while (ctx.measureText(s).width > maxW && f > 18);
  };
  if (!b) {
    fit("🏅 " + title + " 🏅", 92, 900, "900");
    ctx.fillText("🏅 " + title + " 🏅", W / 2, H / 2);
    return;
  }
  fit(b.title, 70, 900, "900");
  ctx.fillText(b.title, W / 2, 92);
  const hasImg = !!(img && img.complete && img.naturalWidth);
  const x0 = hasImg ? 330 : W / 2;
  if (hasImg) ctx.drawImage(img!, 60, 160, 230, 230);
  const wrap = (s: string, y: number, size: number) => {
    ctx.font = `800 ${size}px "Nunito", "Trebuchet MS", system-ui, sans-serif`;
    const maxW = hasImg ? 640 : 900;
    const words = s.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const nx = cur ? cur + " " + w : w;
      if (ctx.measureText(nx).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = nx;
    }
    if (cur) lines.push(cur);
    ctx.textAlign = hasImg ? "left" : "center";
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, hasImg ? x0 : W / 2, y + i * size * 1.15));
    return lines.length;
  };
  const n = wrap(b.line1, 200, 54);
  wrap(b.line2, 200 + Math.min(n, 2) * 62 + 30, 40);
  if (b.stars >= 0) {
    ctx.textAlign = "center";
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.fillStyle = "#ffd25a";
    ctx.fillText("★".repeat(b.stars) + "☆".repeat(Math.max(0, 3 - b.stars)), W - 170, H - 70);
  }
}

function Scoreboard({ url, title }: { url: string; title: string }) {
  const gltf = useModel(url);
  const obj = useMemo(() => gltf.scene.clone(true), [gltf]);
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    // glTF UVs: v = 0 is the top of the picture
    t.flipY = false;
    return { tex: t, ctx: c.getContext("2d")! };
  }, []);
  useEffect(() => {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (o.name === "scoreboard_screen" || (mat && mat.name === "scoreboard_screen")) {
        m.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      }
    });
  }, [obj, tex]);
  const drawn = useRef(-1);
  const img = useRef<HTMLImageElement | null>(null);
  const imgUrl = useRef("");
  useFrame(() => {
    const b = useGames.getState().board;
    const at = b ? b.at : 0;
    if (b && b.iconUrl && b.iconUrl !== imgUrl.current) {
      imgUrl.current = b.iconUrl;
      const im = new Image();
      if (needsLogin(b.iconUrl)) im.crossOrigin = "use-credentials";
      else im.crossOrigin = "anonymous";
      im.onload = () => {
        drawn.current = -1;
      };
      im.src = b.iconUrl;
      img.current = im;
    }
    if (drawn.current === at) return;
    drawn.current = at;
    drawBoard(ctx, b, b && b.iconUrl ? img.current : null, title);
    tex.needsUpdate = true;
  });
  const p = piece("scoreboard");
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.ry}>
      <primitive object={obj} />
    </group>
  );
}

// ------------------------------------------------------------------ the athlete
interface Pose {
  x: number;
  y: number;
  z: number;
  ry: number;
  behaviour: string;
}

/** Where the athlete is at k (0..1 of the show) on its piece (piece-local), given the right / wrong pick. */
function pose(pieceKey: string, k: number, ok: boolean, species: string, time: number): Pose {
  if (pieceKey === "long_jump") {
    const far = ok ? 3.6 : species === "locust" ? 1.5 : 0.25;
    const h = ok ? 0.9 : species === "locust" ? 0.55 : 0.12;
    const j = Math.max(0, Math.min(1, (k - 0.25) / 0.45));
    const flying = j > 0 && j < 1;
    return { x: 0, y: 0.08 + Math.sin(j * Math.PI) * h, z: 1.8 - far * j, ry: Math.PI, behaviour: flying ? "special" : "idle" };
  }
  if (pieceKey === "weight_pull") {
    const dist = pullDistance({ ok, species }) * ease(Math.max(0, (k - 0.15) / 0.7));
    const moving = k > 0.15 && k < 0.85;
    return { x: 0, y: 0.1, z: 0.9 - dist, ry: Math.PI, behaviour: moving ? (ok ? "special" : "move") : "idle" };
  }
  if (pieceKey === "race_lane") {
    const run = ok ? ease(Math.max(0, (k - 0.15) / 0.45)) * 3.5 : Math.min(0.6, Math.max(0, k - 0.15) * 0.9);
    const moving = ok ? k > 0.15 && k < 0.6 : k > 0.15 && k < 0.8;
    return { x: -0.22, y: 0.12, z: 1.75 - run, ry: Math.PI, behaviour: moving ? (ok ? "special" : "move") : "idle" };
  }
  if (pieceKey === "hide_board") {
    // on a twig of the board, head up: the stick insect freezes; anyone else stands out
    return { x: 0.32, y: 0.75, z: 0.2, ry: Math.PI, behaviour: ok ? "special" : "move" };
  }
  if (pieceKey === "night_box") {
    const up = Math.min(1, Math.max(0, (k - 0.2) / 0.4));
    // out of the night box's low door, then a slow hover in front of it
    return ok
      ? { x: Math.sin(time * 1.4) * 0.3, y: 0.15 + up * 0.55 + Math.sin(time * 2.1) * 0.06, z: 0.55 + up * 0.35 + Math.cos(time * 1.1) * 0.12, ry: time * 0.8, behaviour: "move" }
      : { x: 0.15, y: 0.02, z: 0.75, ry: 0.5, behaviour: "idle" };
  }
  // the dance: a figure of eight with a straight wiggly run in the middle (the waggle run)
  const a = time * 1.6;
  if (ok) {
    const loop = Math.sin(a);
    const sideX = Math.cos(a) * 0.32 * (Math.sin(a / 2) > 0 ? 1 : -1);
    return { x: sideX, y: 0.06, z: loop * 0.32, ry: Math.atan2(Math.cos(a), -Math.sin(a)), behaviour: Math.abs(Math.cos(a)) < 0.5 ? "special" : "move" };
  }
  return { x: Math.sin(time * 0.4) * 0.2, y: 0.06, z: 0, ry: time * 0.3, behaviour: "idle" };
}

function Athlete({ sp, pieceKey, ok, at, game }: { sp: GuideSpecies; pieceKey: string; ok: boolean; at: number; game: Game }) {
  const p = (ARENA_PIECES.find((x) => x.key === pieceKey) || ARENA_PIECES[0]) as ArenaPiece;
  const brain = useMemo<Brain>(() => {
    const q = pose(pieceKey, 0, ok, sp.id, 0);
    const w = pieceToWorld(p, q.x, q.z);
    return newBrain(w.x, q.y, w.z, p.ry + q.ry);
  }, [p, pieceKey, ok, sp.id]);
  const think = useMemo<Think>(
    () => (b) => {
      const now = performance.now();
      const k = Math.min(1, (now - at) / 1000 / PLAY_SECONDS);
      const q = pose(pieceKey, k, ok, sp.id, now / 1000);
      const w = pieceToWorld(p, q.x, q.z);
      b.x = w.x;
      b.z = w.z;
      b.y = q.y;
      b.ry = p.ry + q.ry;
      if (b.behaviour !== q.behaviour) setBehaviour(b, q.behaviour, 99);
      b.left = 99;
    },
    [p, pieceKey, ok, sp.id, at],
  );
  const hide = pieceKey === "hide_board";
  const firefly = sp.id === "firefly";
  const glow = useMemo(
    () => (body: THREE.Object3D) => {
      const now = performance.now() / 1000;
      body.traverse((o) => {
        if (o.name === "dung_ball") o.visible = false;
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (firefly && m && m.name === "firefly_glow" && m.emissive) {
          if (m.emissive.getHex() === 0) m.emissive.set("#d8ff6a");
          const ph = now % 2.2;
          m.emissiveIntensity = ok ? 0.6 + (ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) * 4 : 0) : 0.15;
        }
      });
    },
    [firefly, ok],
  );
  const url = hide && sp.camoModelUrl ? sp.camoModelUrl : sp.modelUrl;
  return (
    <Creature
      id={"games-" + sp.id}
      species={sp.id}
      url={url}
      icon={sp.icon}
      scale={(sp.scale || 1) * (sp.id === "flea" ? 1.3 : 1.1)}
      game={game}
      brain={brain}
      think={think}
      shy="none"
      pitch={hide ? -Math.PI / 2 : 0}
      glow={glow}
      clipMap={{ special: sp.id === "dung-beetle" ? "push" : sp.id === "locust" || sp.id === "flea" ? "jump" : sp.id === "tiger-beetle" ? "run" : "special", move: sp.id === "firefly" || sp.id === "honeybee" ? "fly" : "move" }}
    >
      {firefly && ok && <pointLight color="#d8ff6a" intensity={1.2} distance={3.5} decay={2} position={[0, 0.2, -0.1]} />}
    </Creature>
  );
}

/** The round's champions on the podium steps (top step first), resting and now and then showing off. */
const STEPS = [
  { x: 0, y: 0.55 },
  { x: -0.62, y: 0.43 },
  { x: 0.62, y: 0.3 },
];
function Champion({ sp, step, game }: { sp: GuideSpecies; step: number; game: Game }) {
  const p = piece("podium");
  const s = STEPS[step];
  const brain = useMemo<Brain>(() => {
    const w = pieceToWorld(p, s.x, 0.02);
    return newBrain(w.x, s.y, w.z, p.ry);
  }, [p, s]);
  const think = useMemo<Think>(
    () => (b) => {
      if (b.left > 0) return;
      setBehaviour(b, Math.random() < 0.35 ? "special" : "idle", 1.5 + Math.random() * 2);
    },
    [],
  );
  return <Creature id={"podium-" + sp.id} species={sp.id} url={sp.id === "stick-insect" ? sp.modelUrl : sp.modelUrl} icon={sp.icon} scale={(sp.scale || 1) * 0.9} game={game} brain={brain} think={think} shy="none" />;
}

function Guard({ children }: { children: React.ReactNode }) {
  return <GuardC>{children}</GuardC>;
}
class GuardC extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* a piece that cannot load is left out */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Plant({ url, x, z, s }: { url: string; x: number; z: number; s: number }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName("lavender_flowering");
    const g = new THREE.Group();
    if (src) {
      const c = src.clone(true);
      c.position.set(0, 0, 0);
      g.add(c);
    }
    return g;
  }, [gltf]);
  return <primitive object={obj} position={[x, 0, z]} scale={s} />;
}

/** The whole arena, the show of the event being played, and the arena's target (walk up, or tap a piece). */
export function BugGamesArena({ games, exp, game, t }: { games: BugGamesProps; exp: ExpeditionProps; game: Game; t: T }) {
  const play = useGames((s) => s.play);
  const podium = useGames((s) => s.podium);
  const gl = useThree((s) => s.gl);
  useEffect(() => registerEventPieces(games.events || []), [games.events]);
  useEffect(() => {
    const p = ARENA_PIECES.find((x) => x.key === "race_lane")!;
    const own: Target = { key: "games-arena", kind: "games", ref: "games", x: p.x + 2.4, z: p.z, reach: 3.2 };
    const add = () => {
      game.targets = game.targets.filter((x) => x.key !== own.key).concat(own);
    };
    add();
    const id = window.setTimeout(add, 450);
    return () => {
      window.clearTimeout(id);
      game.targets = game.targets.filter((x) => x.key !== own.key);
    };
  }, [game]);
  const m = games.models;
  const urls: Record<string, string> = {
    grandstand: m.grandstand,
    long_jump: m.longJump,
    weight_pull: m.weightPull,
    race_lane: m.raceLane,
    hide_board: m.hideBoard,
    night_box: m.nightBox,
    podium: m.podium,
  };
  const sp = play ? (exp.species || []).find((s) => s.id === play.species) : undefined;
  const pk = play ? pieceOf(play.event) : "";
  const dance = piece("dance");
  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (game.mode !== "play") return;
    const p = ARENA_PIECES.find((x) => x.key === "race_lane")!;
    window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "games-arena", kind: "games", ref: "games", x: p.x + 2.4, z: p.z, reach: 3.2 } }));
  };
  return (
    <group onClick={open} onPointerOver={() => (gl.domElement.style.cursor = "pointer")} onPointerOut={() => (gl.domElement.style.cursor = "")}>
      {ARENA_PIECES.filter((p) => urls[p.key]).map((p) => (
        <Guard key={p.key}>
          <React.Suspense fallback={null}>
            <PieceModel url={urls[p.key]} p={p} />
          </React.Suspense>
        </Guard>
      ))}
      {m.scoreboard && (
        <Guard>
          <React.Suspense fallback={null}>
            <Scoreboard url={m.scoreboard} title={t(games.ui.board)} />
          </React.Suspense>
        </Guard>
      )}
      {exp.models.lavender && (
        <Guard>
          <React.Suspense fallback={null}>
            <Plant url={exp.models.lavender} x={dance.x + 0.9} z={dance.z - 0.6} s={1.1} />
            <Plant url={exp.models.lavender} x={dance.x + 1.0} z={dance.z + 0.7} s={0.9} />
          </React.Suspense>
        </Guard>
      )}
      {podium &&
        !play &&
        podium.team.map((id, i) => {
          const c = (exp.species || []).find((x) => x.id === id);
          return c ? (
            <Guard key={podium.at + id}>
              <Champion sp={c} step={i} game={game} />
            </Guard>
          ) : null;
        })}
      {play && sp && pk && (
        <Guard key={play.at}>
          <Athlete sp={sp} pieceKey={pk} ok={play.ok} at={play.at} game={game} />
        </Guard>
      )}
    </group>
  );
}
