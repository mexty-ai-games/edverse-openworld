import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { BlockProps } from "../block";
import type { Game } from "../game/state";
import { qualityPlan, Settings, TOUCH } from "../settings";
import { World } from "./World";
import { Lanterns } from "./Lanterns";
import { Players } from "./Players";
import type { CardState } from "../ui/Cards";
import { wind } from "./assets";

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

export function GameCanvas({ props, game, settings, paused, onLoaded, onOpen }: {
  props: BlockProps;
  game: Game;
  settings: Settings;
  paused: boolean;
  onLoaded: () => void;
  onOpen: (c: CardState) => void;
}) {
  const plan = qualityPlan(settings.quality);
  const [dpr, setDpr] = useState(plan.dpr);
  useEffect(() => setDpr(qualityPlan(settings.quality).dpr), [settings.quality]);
  const post = plan.bloom || plan.vignette;
  return (
    <Canvas
      className="ow-canvas"
      key={plan.shadows ? "s" : "n"}
      shadows={plan.shadows ? "soft" : false}
      dpr={dpr}
      frameloop={paused ? "never" : "always"}
      camera={{ position: [0, 6, 16], fov: 50, near: 0.3, far: 400 }}
      gl={{ antialias: !TOUCH && !post, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.fog = new THREE.Fog("#c8c48e", 30, 82);
      }}
    >
      <Clock />
      <Suspense fallback={null}>
        <World props={props} game={game} plan={plan} onOpen={onOpen} />
        <Lanterns props={props} game={game} plan={plan} onOpen={onOpen} />
        <Players props={props} game={game} />
        <Loaded onLoaded={onLoaded} />
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
