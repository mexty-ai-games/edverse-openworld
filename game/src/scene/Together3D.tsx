// Phase 3 in 3D. In the Idea Grove: the community garden (everyone's plants growing in raised beds, and
// the pollinators that really come to them), the Explorers' Museum (photo displays redrawn from photo
// records, a sticker board), and the BioBlitz banner with its progress totem. In every zone: the tool an
// explorer holds out for a team-up find (a red lantern, an open jar), the Keeper's helper who holds it
// for a lone explorer, and the glow over a creature another explorer is showing a beginner.
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { BlockProps, ExpeditionProps, GardenPlant, GuideSpecies, T, TogetherProps } from "../block";
import type { Game, Target } from "../game/state";
import {
  BLITZ_BANNER, BLITZ_TOTEM, GARDEN_BEDS, MUSEUM, SEED_STAND, groundY as groveGround, museumPoint,
} from "../game/layout";
import { Display, KEEPER_NICK, PLANT_STAGES, Plot, blitzEnd, pollinatorsFor, useTogether } from "../game/together";
import { glowTexture, needsLogin, useModel } from "./assets";
import { Brain, Creature, newBrain, setBehaviour, Think, walkTo } from "./creatures";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { tgUi } from "../together/content";

// ------------------------------------------------------------------ helpers
class Guard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
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

function Safe({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </Guard>
  );
}

/** One node of a kit .glb (kits lay their pieces out along X), cloned and put back at the origin. */
function KitNode({ url, node, onReady }: { url: string; node: string; onReady?: (o: THREE.Object3D) => void }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(node);
    if (!src) return null;
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    return c;
  }, [gltf, node]);
  useEffect(() => {
    if (obj && onReady) onReady(obj);
  }, [obj, onReady]);
  return obj ? <primitive object={obj} /> : null;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** The six planting spots of a bed (bed-local x, z; the soil is at y = 0.35). */
export const PLOTS: [number, number][] = [
  [-0.5, 0.2],
  [-0.5, -0.2],
  [0, 0.2],
  [0, -0.2],
  [0.5, 0.2],
  [0.5, -0.2],
];
const SOIL_Y = 0.35;
/** Plants are real size: a little smaller in the beds so neighbours do not crowd each other. */
const PLANT_S = [1.4, 1.1, 1.0];

/** Bed-local (model units) to the world. */
export function bedPoint(bed: number, lx: number, ly: number, lz: number) {
  const b = GARDEN_BEDS[bed];
  const c = Math.cos(b.ry);
  const s = Math.sin(b.ry);
  return { x: b.x + (lx * c + lz * s) * b.s, y: ly * b.s, z: b.z + (-lx * s + lz * c) * b.s };
}

function setTargets(game: Game, prefix: string, own: Target[]) {
  game.targets = game.targets.filter((t) => t.key.indexOf(prefix) !== 0).concat(own);
}

/** Keeps a group of targets registered (the grove's own list may be reset after ours is added). Returns the cleanup. */
function keepTargets(game: Game, prefix: string, own: Target[]): () => void {
  const add = () => {
    const have = game.targets.filter((t) => t.key.indexOf(prefix) === 0).length;
    if (have !== own.length) setTargets(game, prefix, own);
  };
  add();
  const id = window.setInterval(add, 1000);
  return () => {
    window.clearInterval(id);
    setTargets(game, prefix, []);
  };
}

// ------------------------------------------------------------------ the garden
function Bed({ url, bed }: { url: string; bed: number }) {
  const b = GARDEN_BEDS[bed];
  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.ry} scale={b.s} onClick={(e) => {
      e.stopPropagation();
      const p = bedPoint(bed, 0, 0, 0.9);
      window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "tg-bed-" + bed, kind: "tg:bed", ref: bed, x: p.x, z: p.z, reach: 2 } }));
    }}>
      <Safe>
        <KitNode url={url} node="bed_soil" />
      </Safe>
      {bed === 0 && <BedSign />}
    </group>
  );
}

/** The Keeper's bed has a small painted sign: a sun over a flower (no words). */
function BedSign() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#e9cf98";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "#7a4a1c";
    g.lineWidth = 10;
    g.strokeRect(5, 5, 118, 118);
    g.font = "64px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("🌼", 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group position={[0.92, 0, 0.42]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.04, 0.6, 0.04]} />
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0.025]} castShadow>
        <boxGeometry args={[0.26, 0.26, 0.03]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
    </group>
  );
}

function PlantAt({ url, plot }: { url: string; plot: Plot }) {
  const [lx, lz] = PLOTS[plot.slot];
  const stage = PLANT_STAGES[plot.stage];
  const b = GARDEN_BEDS[plot.bed];
  const s = PLANT_S[plot.stage] * (plot.plant === "sunflower" && plot.stage === 2 ? 0.8 : 1);
  const p = bedPoint(plot.bed, lx, SOIL_Y, lz);
  return (
    <group position={[p.x, p.y - 0.02, p.z]} rotation-y={b.ry + plot.slot * 1.3} scale={s * b.s * 0.85}>
      <Safe>
        <KitNode url={url} node={plot.plant + "_" + stage} />
      </Safe>
    </group>
  );
}

/** A pollinator flies from one of its flowers to the next, drinking nectar at each. */
function flyThink(key: string, spots: { current: { x: number; y: number; z: number; key: string }[] }, speed: number): Think {
  let at = 0;
  return (b, dt, time) => {
    const list = spots.current;
    const feeding = useTogether.getState().feeding;
    if (!list.length) return;
    const sp = list[at % list.length];
    if (b.behaviour === "move" || b.behaviour === "idle") {
      b.ax = sp.x;
      b.az = sp.z;
      const hover = sp.y + 0.12 + Math.sin(time * 4.2) * 0.05;
      b.y += (hover - b.y) * Math.min(1, dt * 2.4);
      if (walkTo(b, dt, speed, 5) && Math.abs(b.y - hover) < 0.25) {
        setBehaviour(b, "feed", rnd(3.5, 6));
        feeding[key] = sp.key;
      }
      return;
    }
    if (b.behaviour === "feed") {
      b.x += (sp.x - b.x) * Math.min(1, dt * 4);
      b.z += (sp.z - b.z) * Math.min(1, dt * 4);
      b.y += (sp.y + 0.02 - b.y) * Math.min(1, dt * 4);
      if (b.left > 0) return;
    }
    delete feeding[key];
    if (list.length > 1) at = (at + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    setBehaviour(b, "move", 12);
  };
}

function Pollinator({ sp, spots, game }: { sp: GuideSpecies; spots: { x: number; y: number; z: number; key: string }[]; game: Game }) {
  const ref = useRef(spots);
  ref.current = spots;
  const key = "garden-" + sp.id;
  const brain = useMemo<Brain>(() => {
    const s0 = spots[0] || { x: 10, y: 1, z: -11 };
    const b = newBrain(s0.x + rnd(-2, 2), s0.y + 1.2, s0.z + rnd(-2, 2));
    setBehaviour(b, "move", 12);
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const think = useMemo(() => flyThink(key, ref, sp.id === "hummingbird" ? 2.2 : sp.id === "monarch" ? 0.9 : 1.3), [key]);
  useEffect(() => () => void delete useTogether.getState().feeding[key], [key]);
  const clip = sp.id === "monarch" ? { move: "move", idle: "fly", feed: "feed", flee: "fly", hide: "fly" } : { move: "fly", idle: "fly", feed: "feed", flee: "fly", hide: "fly" };
  return (
    <Creature
      id={key}
      species={sp.id}
      url={sp.modelUrl}
      icon={sp.icon}
      scale={sp.scale || 3}
      game={game}
      brain={brain}
      think={think}
      catchable={!!sp.catchable}
      shy="run"
      fleeSpeed={2.4}
      home={{ x: brain.x, z: brain.z, r: 4 }}
      clipMap={clip}
    />
  );
}

function Garden({ tp, exp, game }: { tp: TogetherProps; exp: ExpeditionProps; game: Game }) {
  const plots = useTogether((s) => s.plots);
  const byPlant = useMemo(() => {
    const m: Record<string, GardenPlant> = {};
    for (const p of tp.plants) m[p.id] = p;
    return m;
  }, [tp.plants]);
  const [visit, setVisit] = React.useState<Record<string, { x: number; y: number; z: number }>>({});
  const onVisit = React.useCallback((id: string, v: { x: number; y: number; z: number }) => setVisit((o) => (o[id] ? o : { ...o, [id]: v })), []);
  const spotsBy = useMemo(() => {
    const out: Record<string, { x: number; y: number; z: number; key: string }[]> = {};
    const pol = pollinatorsFor(plots, tp.plants);
    for (const sp of Object.keys(pol)) {
      out[sp] = pol[sp].map((p) => {
        const [lx, lz] = PLOTS[p.slot];
        const v = visit[p.plant] || { x: 0, y: 0.6, z: 0 };
        const k = PLANT_S[2] * 0.85 * (p.plant === "sunflower" ? 0.8 : 1);
        const b = GARDEN_BEDS[p.bed];
        const a = b.ry + p.slot * 1.3;
        const vx = (v.x * Math.cos(a) + v.z * Math.sin(a)) * k * b.s;
        const vz = (-v.x * Math.sin(a) + v.z * Math.cos(a)) * k * b.s;
        const w = bedPoint(p.bed, lx, SOIL_Y, lz);
        return { x: w.x + vx, y: w.y + v.y * k * b.s, z: w.z + vz, key: p.bed + ":" + p.slot + ":" + p.plant };
      });
    }
    return out;
  }, [plots, tp.plants, visit]);
  const species = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);
  // the beds are things to use: the HUD's action button reaches them too
  useEffect(() => {
    const own: Target[] = GARDEN_BEDS.map((_, i) => {
      const p = bedPoint(i, 0, 0, 0.95);
      return { key: "tg-bed-" + i, kind: "tg:bed", ref: i, x: p.x, z: p.z, reach: 1.9 };
    });
    return keepTargets(game, "tg-bed-", own);
  }, [game]);
  return (
    <>
      {GARDEN_BEDS.map((_, i) => (
        <Bed key={i} url={tp.models.bedSoil} bed={i} />
      ))}
      {plots.map((p) =>
        byPlant[p.plant] && byPlant[p.plant].modelUrl ? <PlantAt key={p.bed + ":" + p.slot + ":" + p.at + ":" + p.stage} url={byPlant[p.plant].modelUrl} plot={p} /> : null,
      )}
      <group position={[SEED_STAND.x, 0, SEED_STAND.z]} rotation-y={SEED_STAND.ry}>
        <Safe>
          <KitNode url={tp.models.plinth} node="plinth" />
        </Safe>
        {tp.models.packets &&
          ["sunflower", "lavender", "foxglove", "clover", "tomato", "milkweed"].map((id, i) => (
            <group key={id} position={[-0.2 + (i % 3) * 0.2, 1.03, i < 3 ? -0.07 : 0.09]} rotation-x={-0.25} scale={1.3}>
              <Safe>
                <KitNode url={tp.models.packets} node={"packet_" + id} />
              </Safe>
            </group>
          ))}
        <group position={[0.62, 0, 0.18]} rotation-y={-0.6} scale={1.4}>
          <Safe>
            <KitNode url={tp.models.can} node="watering_can" />
          </Safe>
        </group>
      </group>
      {tp.plants.map((p) =>
        p.modelUrl ? (
          <Safe key={"v" + p.id}>
            <VisitProbe plant={p} onVisit={onVisit} />
          </Safe>
        ) : null,
      )}
      {Object.keys(spotsBy).map((id) =>
        species[id] && spotsBy[id].length ? <Pollinator key={id} sp={species[id]} spots={spotsBy[id]} game={game} /> : null,
      )}
    </>
  );
}

/** Reads where a plant's visitors drink: the `<plant>_visit` empty of its flowering model (plant-local). */
function VisitProbe({ plant, onVisit }: { plant: GardenPlant; onVisit: (id: string, v: { x: number; y: number; z: number }) => void }) {
  const gltf = useModel(plant.modelUrl);
  useEffect(() => {
    const node = gltf.scene.getObjectByName(plant.id + "_flowering");
    const v = node ? node.getObjectByName(plant.id + "_visit") : null;
    if (v) onVisit(plant.id, { x: v.position.x, y: v.position.y, z: v.position.z });
    else if (node) {
      const box = new THREE.Box3().setFromObject(node);
      onVisit(plant.id, { x: 0, y: Math.max(0.2, (box.max.y - node.position.y) * 0.85), z: 0 });
    }
  }, [gltf, plant, onVisit]);
  return null;
}

// ------------------------------------------------------------------ the Explorers' Museum
const imgCache: Record<string, Promise<HTMLImageElement | null>> = {};
function loadImg(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  if (!imgCache[url])
    imgCache[url] = new Promise((res) => {
      const im = new Image();
      im.crossOrigin = needsLogin(url) ? "use-credentials" : "anonymous";
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    });
  return imgCache[url];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A display's card, drawn from its photo records (never images taken by a player): the species' pictures, stars, the stickers. */
async function drawCard(c: HTMLCanvasElement, d: Display, title: string, species: Record<string, GuideSpecies>, stickers: { id: string; url: string }[], counts: Record<string, number>) {
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#fff6df");
  bg.addColorStop(1, "#efd9a8");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b5782c";
  g.lineWidth = 14;
  g.strokeRect(7, 7, W - 14, H - 14);
  g.fillStyle = "#4a2a10";
  g.font = "900 34px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText((d.keeper ? "🧓 " : "🧭 ") + title, W / 2, 52, W - 50);
  const cells = [
    [28, 92],
    [264, 92],
    [28, 330],
    [264, 330],
  ];
  const pics = await Promise.all(d.photos.map((p) => loadImg((species[p.species] || ({} as GuideSpecies)).iconUrl || "")));
  cells.forEach(([x, y], i) => {
    roundRect(g, x, y, 220, 222, 18);
    g.fillStyle = i < d.photos.length ? "#fdf3dc" : "rgba(120, 80, 30, 0.12)";
    g.fill();
    g.strokeStyle = "#c99a52";
    g.lineWidth = 4;
    g.stroke();
    const p = d.photos[i];
    if (!p) return;
    const im = pics[i];
    if (im) {
      const k = Math.min(196 / im.width, 168 / im.height);
      g.drawImage(im, x + 110 - (im.width * k) / 2, y + 96 - (im.height * k) / 2, im.width * k, im.height * k);
    } else {
      g.font = "110px system-ui, sans-serif";
      g.fillText((species[p.species] || { icon: "❓" }).icon, x + 110, y + 98);
    }
    g.font = "900 34px system-ui, sans-serif";
    g.fillStyle = "#e0a020";
    g.strokeStyle = "#6a3c10";
    g.lineWidth = 3;
    const stars = "★".repeat(p.stars) + "☆".repeat(3 - p.stars);
    g.strokeText(stars, x + 110, y + 198);
    g.fillText(stars, x + 110, y + 198);
    g.fillStyle = "#4a2a10";
  });
  // the stickers visitors left
  const st = stickers.filter((s) => counts[s.id]);
  const sp = await Promise.all(st.map((s) => loadImg(s.url)));
  st.slice(0, 6).forEach((s, i) => {
    const x = W / 2 - (Math.min(6, st.length) * 78) / 2 + i * 78 + 39;
    const y = 612;
    const im = sp[i];
    if (im) g.drawImage(im, x - 30, y - 34, 60, 60);
    g.font = "900 24px system-ui, sans-serif";
    g.fillStyle = "#4a2a10";
    g.fillText("×" + counts[s.id], x + 2, y + 44);
  });
}

function Frame({ url, d, title, species, stickers, counts, at, ry }: {
  url: string;
  d: Display;
  title: string;
  species: Record<string, GuideSpecies>;
  stickers: { id: string; url: string }[];
  counts: Record<string, number>;
  at: THREE.Vector3;
  ry: number;
}) {
  const gltf = useModel(url);
  const { obj, tex } = useMemo(() => {
    const src = gltf.scene.getObjectByName("museum_frame") || gltf.scene;
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 680;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // the card face's UVs run the other way round: turn the picture a half turn
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI;
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh && (mesh.name === "photo_card" || (mesh.material as THREE.Material).name === "photo_card")) {
        mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.18 });
      }
    });
    return { obj: o, tex };
  }, [gltf]);
  const sig = JSON.stringify([d.photos, title, counts]);
  useEffect(() => {
    let alive = true;
    drawCard(tex.image as HTMLCanvasElement, d, title, species, stickers, counts).then(() => alive && (tex.needsUpdate = true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tex]);
  return (
    <group position={at} rotation-y={ry} scale={1.5}>
      <primitive object={obj} />
    </group>
  );
}

/** Which display stands at which spot: the Keeper's in the middle, mine at the back wall, then the others. */
const SPOT_ORDER = ["spot_11", "spot_02", "spot_01", "spot_03", "spot_00", "spot_04", "spot_06", "spot_09", "spot_05", "spot_08", "spot_07", "spot_10"];

function spotFacing(p: THREE.Vector3): number {
  if (p.x < -4.5) return Math.PI / 2;
  if (p.x > 4.5) return -Math.PI / 2;
  return 0;
}

function Museum({ tp, exp, game, t }: { tp: TogetherProps; exp: ExpeditionProps; game: Game; t: T }) {
  const gltf = useModel(tp.models.museum);
  const building = useMemo(() => {
    const src = gltf.scene.getObjectByName("museum_building") || gltf.scene;
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    return o;
  }, [gltf]);
  const spots = useMemo(() => {
    const m: Record<string, THREE.Vector3> = {};
    building.traverse((o) => {
      if (/^spot_\d+$/.test(o.name)) m[o.name] = o.position.clone();
    });
    return m;
  }, [building]);
  const displays = useTogether((s) => s.displays);
  const stickers = useTogether((s) => s.stickers);
  const species = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);
  const placed = useMemo(
    () =>
      displays.slice(0, SPOT_ORDER.length).map((d, i) => {
        const p = spots[SPOT_ORDER[i]] || new THREE.Vector3(0, 0.44, 0);
        const ry = spotFacing(p);
        return { d, p, ry, front: { x: p.x + Math.sin(ry) * 1.1, z: p.z + Math.cos(ry) * 1.1 } };
      }),
    [displays, spots],
  );
  const targets = placed.map((x) => x.d.owner + "@" + Math.round(x.front.x * 10) + "," + Math.round(x.front.z * 10)).join("|");
  useEffect(() => {
    const own: Target[] = placed.map((x) => {
      const w = museumPoint(x.front.x, x.front.z);
      return { key: "tg-disp-" + x.d.owner, kind: "tg:display", ref: x.d.owner, x: w.x, z: w.z, reach: 1.25 };
    });
    return keepTargets(game, "tg-disp-", own);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, targets]);
  const board = spots.spot_12;
  return (
    <group position={[MUSEUM.x, 0, MUSEUM.z]} rotation-y={MUSEUM.ry} scale={MUSEUM.s}>
      <primitive object={building} />
      {placed.map((x) => (
        <group
          key={x.d.owner}
          onClick={(e) => {
            e.stopPropagation();
            const w = museumPoint(x.front.x, x.front.z);
            window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "tg-disp-" + x.d.owner, kind: "tg:display", ref: x.d.owner, x: w.x, z: w.z, reach: 1.25 } }));
          }}
        >
          <Safe>
            <Frame
              url={tp.models.frame}
              d={x.d}
              title={x.d.keeper ? t(tgUi(tp).keeperDisplay) : x.d.owner}
              species={species}
              stickers={tp.stickers}
              counts={stickers[x.d.owner] || {}}
              at={x.p}
              ry={x.ry}
            />
          </Safe>
        </group>
      ))}
      {board && (
        <group position={board} rotation-y={0} scale={1.1}>
          <Safe>
            <KitNode url={tp.models.stickerBoard} node="sticker_board" />
          </Safe>
        </group>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ the BioBlitz banner and totem
function Blitz({ tp, game }: { tp: TogetherProps; game: Game }) {
  const totem = useModel(tp.models.totem);
  const obj = useMemo(() => {
    const src = totem.scene.getObjectByName("progress_totem") || totem.scene;
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      // the progress column glows leaf-green (a colour-blind-safe green with a bright core)
      if (/fill/.test(mat.name) && mat.emissive) {
        mat.color.set("#9be37c");
        mat.emissive.set("#4fbf45");
        mat.emissiveIntensity = 0.9;
      }
      mesh.material = mat;
    });
    return o;
  }, [totem]);
  const fill = useMemo(() => obj.getObjectByName("totem_fill"), [obj]);
  const crown = useMemo(() => obj.getObjectByName("totem_crown"), [obj]);
  const shown = useRef(0);
  useFrame((_, dt) => {
    const s = useTogether.getState();
    const b = s.blitz;
    const live = b && Date.now() < blitzEnd(b, tp.rules);
    const want = live ? Math.min(1, b!.found.length / Math.max(1, tp.rules.blitzGoal)) : 0;
    shown.current += (want - shown.current) * Math.min(1, dt * 2);
    if (fill) {
      fill.scale.y = Math.max(0.001, shown.current);
      fill.visible = shown.current > 0.005;
    }
    const time = performance.now() / 1000;
    const full = shown.current > 0.98;
    crown?.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && mat.emissive) mat.emissiveIntensity = full ? 2.2 + Math.sin(time * 4) * 0.8 : live ? 0.6 + Math.sin(time * 2) * 0.2 : 0.25;
    });
  });
  useEffect(() => {
    const own: Target[] = [{ key: "tg-blitz", kind: "tg:blitz", ref: "blitz", x: BLITZ_TOTEM.x - Math.sin(BLITZ_TOTEM.ry) * -1.1, z: BLITZ_TOTEM.z + Math.cos(BLITZ_TOTEM.ry) * 1.1, reach: 2.4 }];
    return keepTargets(game, "tg-blitz", own);
  }, [game]);
  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("ow-open", { detail: { key: "tg-blitz", kind: "tg:blitz", ref: "blitz", x: BLITZ_TOTEM.x, z: BLITZ_TOTEM.z, reach: 2.6 } }));
  };
  return (
    <>
      <group position={[BLITZ_BANNER.x, 0, BLITZ_BANNER.z]} rotation-y={BLITZ_BANNER.ry} onClick={open}>
        <Safe>
          <KitNode url={tp.models.banner} node="bioblitz_banner" />
        </Safe>
      </group>
      <group position={[BLITZ_TOTEM.x, groveGround(BLITZ_TOTEM.x, BLITZ_TOTEM.z), BLITZ_TOTEM.z]} rotation-y={BLITZ_TOTEM.ry} onClick={open}>
        <primitive object={obj} />
      </group>
    </>
  );
}

/** Everything of phase 3 that lives in the Idea Grove. */
export function GroveTogether({ tp, exp, game, t }: { tp: TogetherProps; exp: ExpeditionProps; game: Game; t: T }) {
  return (
    <>
      <Garden tp={tp} exp={exp} game={game} />
      <Safe>
        <Museum tp={tp} exp={exp} game={game} t={t} />
      </Safe>
      <Safe>
        <Blitz tp={tp} game={game} />
      </Safe>
    </>
  );
}

// ------------------------------------------------------------------ every zone: held tools, the helper, the glow
const POOL = 4;
const HELPER_LOOK: Record<string, string> = { skin: "#c58c62", hair: "#3b2a1e", shirt: "#d98c3a", pants: "#4f6b3a", shoes: "#4a3424", bag: "#7a5230" };

/** The Keeper's helper: the explorers' base model in a gardener's colours, waving when it arrives, then idle. */
function HelperBody({ url, since }: { url: string; since: number }) {
  const gltf = useModel(url);
  const { obj, mixer, actions } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const cl = list.map((x) => {
        const c = (x as THREE.MeshStandardMaterial).clone();
        if (HELPER_LOOK[c.name]) c.color.set(HELPER_LOOK[c.name]);
        return c;
      });
      m.material = Array.isArray(m.material) ? cl : cl[0];
    });
    const mixer = new THREE.AnimationMixer(obj);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
    if (actions.wave) {
      actions.wave.setLoop(THREE.LoopOnce, 1);
      actions.wave.clampWhenFinished = true;
    }
    if (actions.idle) actions.idle.play();
    return { obj, mixer, actions };
  }, [gltf]);
  const cur = useRef("idle");
  useFrame((_, dt) => {
    const want = performance.now() - since < 1500 && actions.wave ? "wave" : "idle";
    if (want !== cur.current && actions[want]) {
      const next = actions[want];
      next.reset().play();
      const prev = actions[cur.current];
      if (prev && prev !== next) prev.crossFadeTo(next, 0.25, false);
      cur.current = want;
    }
    mixer.update(Math.min(dt, 0.1));
  });
  return <primitive object={obj} />;
}

function HeldTools({ lanternUrl, jarUrl, game, ground }: { lanternUrl: string; jarUrl: string; game: Game; ground: (x: number, z: number) => number }) {
  const lg = useModel(lanternUrl);
  const jg = useModel(jarUrl || lanternUrl);
  const pool = useMemo(
    () =>
      Array.from({ length: POOL }, () => {
        const lantern = lg.scene.clone(true);
        lantern.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          if (/glow/.test(mat.name) || /glow/.test(mesh.name)) {
            mat.color.set("#ff5a3a");
            mat.emissive = new THREE.Color("#ff3b1f");
            mat.emissiveIntensity = 2.4;
            mat.toneMapped = false;
          }
          mesh.material = mat;
        });
        const jar = jarUrl ? jg.scene.clone(true) : new THREE.Group();
        return { lantern, jar };
      }),
    [lg, jg, jarUrl],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(() => {
    const list: { x: number; z: number; ry: number; hold: string }[] = [];
    if (game.me.hold && game.mode === "play") list.push({ x: game.me.x, z: game.me.z, ry: game.me.ry, hold: game.me.hold });
    game.peers.forEach((p) => {
      if (p.hold && !game.hidden.has(p.id) && list.length < POOL) list.push({ x: p.x, z: p.z, ry: p.ry, hold: p.hold });
    });
    const h = useTogether.getState().helper;
    if (h && list.length < POOL) {
      const c = useTogether.getState();
      void c;
      list.push({ x: h.x, z: h.z, ry: h.ry, hold: h.coop.indexOf("jar") >= 0 ? "jar" : "lantern" });
    }
    for (let i = 0; i < POOL; i++) {
      const g = groups.current[i];
      const l = lights.current[i];
      const it = list[i];
      if (!g) continue;
      g.visible = !!it;
      if (l) l.intensity = it && it.hold === "lantern" ? 2.2 : 0;
      if (!it) continue;
      const fx = Math.sin(it.ry);
      const fz = Math.cos(it.ry);
      // held out in front, a little to the right
      g.position.set(it.x + fx * 0.45 + fz * 0.25, ground(it.x, it.z) + (it.hold === "lantern" ? 1.45 : 0.95), it.z + fz * 0.45 - fx * 0.25);
      g.rotation.y = it.ry;
      const [lan, jar, , halo] = g.children;
      if (lan) lan.visible = it.hold === "lantern";
      if (jar) jar.visible = it.hold === "jar";
      if (halo) {
        halo.visible = it.hold === "lantern";
        const k = 1.1 + Math.sin(performance.now() / 260 + i) * 0.08;
        halo.scale.set(k, k, 1);
      }
    }
  });
  return (
    <>
      {pool.map((p, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <primitive object={p.lantern} scale={2.2} />
          <primitive object={p.jar} scale={1.6} />
          <pointLight ref={(l) => void (lights.current[i] = l)} color="#ff4a2a" intensity={0} distance={5} decay={2} position={[0, -0.5, 0]} />
          {/* the lantern's soft red halo (dim red light: fireflies keep flashing) */}
          <sprite position={[0, -0.5, 0]} renderOrder={6}>
            <spriteMaterial map={glowTexture()} color="#ff5a3a" transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </>
  );
}

function Helper({ props, tp, t, ground }: { props: BlockProps; tp: TogetherProps; t: T; ground: (x: number, z: number) => number }) {
  const helper = useTogether((s) => s.helper);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    const h = useTogether.getState().helper;
    if (!g || !h) return;
    g.position.set(h.x, ground(h.x, h.z), h.z);
    g.rotation.y = h.ry;
  });
  if (!helper) return null;
  return (
    <group ref={ref}>
      <group scale={0.92}>
        <HelperBody url={props.models.avatar} since={helper.at} />
      </group>
      <Html position={[0, 1.45, 0]} center zIndexRange={[7, 0]} style={{ pointerEvents: "none" }}>
        <div className="ow-tagwrap">
          <div className="ow-tag tg-helper-tag">🧑‍🌾 {t(tp.helperName)}</div>
        </div>
      </Html>
    </group>
  );
}

/** The glow over a creature another explorer is showing me. */
function Beacon({ game }: { game: Game }) {
  const spr = useRef<THREE.Sprite>(null);
  const col = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const b = useTogether.getState().beacon;
    const on = !!b && Date.now() < b.until;
    let c = null as null | (typeof game.creatures)[number];
    if (on) {
      let best = 1e9;
      for (const x of game.creatures) {
        if (x.species !== b!.species || x.hidden) continue;
        const d = Math.hypot(x.obj.position.x - game.me.x, x.obj.position.z - game.me.z);
        if (d < best) {
          best = d;
          c = x;
        }
      }
    }
    const t = performance.now() / 1000;
    for (const o of [spr.current, col.current]) if (o) o.visible = !!c;
    if (!c) return;
    const p = c.obj.position;
    if (spr.current) {
      spr.current.position.set(p.x, p.y + c.cy, p.z);
      const s = Math.max(0.8, c.radius * 4) * (1 + Math.sin(t * 5) * 0.15);
      spr.current.scale.set(s, s, 1);
    }
    if (col.current) {
      col.current.position.set(p.x, p.y + 2.5, p.z);
      (col.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 3) * 0.08;
    }
  });
  return (
    <>
      <sprite ref={spr} visible={false} renderOrder={6}>
        <spriteMaterial map={glowTexture()} color="#fff1a0" transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh ref={col} visible={false} renderOrder={5}>
        <cylinderGeometry args={[0.12, 0.35, 5, 12, 1, true]} />
        <meshBasicMaterial color="#ffe27a" transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** Phase 3 pieces drawn in every zone. */
export function TogetherAll({ props, tp, exp, game, t, ground }: { props: BlockProps; tp: TogetherProps; exp: ExpeditionProps; game: Game; t: T; ground: (x: number, z: number) => number }) {
  const jar = (exp.tools || []).find((x) => x.id === "jar");
  return (
    <>
      {tp.models.lantern && (
        <Safe>
          <HeldTools lanternUrl={tp.models.lantern} jarUrl={(jar && jar.modelUrl) || ""} game={game} ground={ground} />
        </Safe>
      )}
      <Safe>
        <Helper props={props} tp={tp} t={t} ground={ground} />
      </Safe>
      <Beacon game={game} />
    </>
  );
}
