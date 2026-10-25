import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { BlockProps, T } from "../block";
import type { Game, Peer } from "../game/state";
import { qualityPlan, Settings, TOUCH } from "../settings";
import { World } from "./World";
import { Lanterns } from "./Lanterns";
import { Players, GROVE_LAYOUT, ZoneLayout } from "./Players";
import { StallPreviews } from "./Previews";
import type { CardState } from "../ui/Cards";
import type { ZoneModule } from "../zones/registry";
import { wind } from "./assets";
import { GroveExpedition } from "./Expedition3D";
import { GroveTogether, TogetherAll } from "./Together3D";
import { defaultTogether } from "../together/content";
import { defaultExpedition } from "../expedition/content";
import { HeldNet } from "./HeldNet";
import { BugGamesArena } from "./BugGames3D";
import { defaultBugGames } from "../expedition/bugGames";

/** Keeps the picture smooth on slower phones: when the frame rate stays low, fewer pixels are drawn. */
function AdaptiveDpr({ active, min, dpr, onChange }: { active: boolean; min: number; dpr: number; onChange: (d: number) => void }) {
  const acc = useRef({ t: 0, n: 0, skip: 2 });
  useFrame((_, dt) => {
    if (!active) return;
    const a = acc.current;
    a.t += dt;
    a.n++;
    if (a.t < 2) return;
    const fps = a.n / a.t;
    a.t = 0;
    a.n = 0;
    if (a.skip > 0) {
      a.skip--; // the first seconds compile shaders: not a fair measure
      return;
    }
    if (fps < 40 && dpr > min + 0.01) onChange(Math.max(min, Math.round((dpr - 0.15) * 100) / 100));
  });
  return null;
}

function Clock() {
  useFrame((_, dt) => {
    wind.value += Math.min(dt, 0.1);
  });
  return null;
}

function Loaded({ onLoaded }: { onLoaded: () => void }) {
  useEffect(() => {
    // one more frame so the first picture is on screen before the loader goes
    const id = window.setTimeout(onLoaded, 120);
    return () => window.clearTimeout(id);
  }, [onLoaded]);
  return null;
}

/** A district that cannot load sends the explorer back to the grove instead of an error screen. */
class ZoneGuard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface ActiveZone {
  id: string;
  /** The district's module (null in the Idea Grove). */
  mod: ZoneModule | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any;
  layout: ZoneLayout;
}

export const GROVE_ZONE: ActiveZone = { id: "idea-grove", mod: null, props: null, layout: GROVE_LAYOUT };

export function GameCanvas({ props, game, settings, paused, zone, onZoneReady, onZoneError, onOpen, onDistrictOpen, onExit, onPeerTap, t }: {
  props: BlockProps;
  game: Game;
  settings: Settings;
  paused: boolean;
  zone: ActiveZone;
  /** The active zone's first picture is on screen (ends the loader / the fade). */
  onZoneReady: () => void;
  onZoneError: () => void;
  onOpen: (c: CardState) => void;
  /** A district scene asks the hub to open something (Skyharbor's onOpen). */
  onDistrictOpen: (o: { kind: string; ref?: string }) => void;
  onExit: () => void;
  onPeerTap: (p: Peer) => void;
  t: T;
}) {
  const plan = qualityPlan(settings.quality);
  const [dpr, setDpr] = useState(plan.dpr);
  useEffect(() => setDpr(qualityPlan(settings.quality).dpr), [settings.quality]);
  const post = plan.bloom || plan.vignette;
  const Scene = zone.mod ? zone.mod.Scene : null;
  return (
    <Canvas
      className="ow-canvas"
      key={plan.shadows ? "s" : "n"}
      shadows={plan.shadows ? "soft" : false}
      dpr={dpr}
      frameloop={paused ? "never" : "always"}
      camera={{ position: [0, 6, 16], fov: 50, near: 0.3, far: 700 }}
      gl={{ antialias: !TOUCH && !post, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.fog = new THREE.Fog("#c8c48e", 30, 82);
      }}
    >
      <Clock />
      <Suspense fallback={null}>
        {/* only one zone's scene at a time: districts set (and restore) fog and exposure themselves */}
        {!Scene ? (
          <Suspense fallback={null} key="idea-grove">
            <World props={props} game={game} plan={plan} onOpen={onOpen} />
            <Lanterns props={props} game={game} plan={plan} onOpen={onOpen} />
            <StallPreviews props={props} />
            <Suspense fallback={null}>
              <GroveExpedition props={props} exp={props.expedition || defaultExpedition} game={game} />
            </Suspense>
            <Suspense fallback={null}>
              <GroveTogether tp={props.together || defaultTogether} exp={props.expedition || defaultExpedition} game={game} t={t} />
            </Suspense>
            <Suspense fallback={null}>
              <BugGamesArena games={props.bugGames || defaultBugGames} exp={props.expedition || defaultExpedition} game={game} t={t} />
            </Suspense>
            <Loaded onLoaded={onZoneReady} />
          </Suspense>
        ) : (
          <ZoneGuard key={zone.id} onError={onZoneError}>
            <Suspense fallback={null}>
              <Scene props={zone.props} game={game} plan={plan} onOpen={onDistrictOpen} onExit={onExit} expedition={props.expedition || defaultExpedition} />
              <Loaded onLoaded={onZoneReady} />
            </Suspense>
          </ZoneGuard>
        )}
        <Players props={props} game={game} layout={zone.layout} onPeerTap={onPeerTap} />
        <TogetherAll props={props} tp={props.together || defaultTogether} exp={props.expedition || defaultExpedition} game={game} t={t} ground={zone.layout.groundY} />
        <HeldNet url={((props.expedition || defaultExpedition).tools.find((x) => x.id === "net") || { modelUrl: "" }).modelUrl} game={game} />
      </Suspense>
      <AdaptiveDpr active={plan.adaptive && !paused} min={plan.minDpr} dpr={dpr} onChange={setDpr} />
      {post && (
        <EffectComposer multisampling={plan.msaa} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
          <Vignette offset={0.28} darkness={plan.vignette ? 0.5 : 0} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
