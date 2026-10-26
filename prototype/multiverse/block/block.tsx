// EdVerse OpenWorld v2: the multiverse (prototype). One fjord in four universes (today, the Ice Age,
// 2300, half gravity); walk through the rift to compare them. The 3D engine lives in ./mv (the same code
// as mexty-ai-games/edverse-openworld prototype/multiverse); this file connects it to EdVerse: props,
// language, pause, ready and learning progress.
import React, { useEffect, useRef } from "react";
import { useLanguage, useMexty } from "@mexty/sdk";
import { startMultiverse } from "./mv/engine";
import { resolveText } from "./mv/text";

interface LocalizedText {
  en?: string;
  fr?: string;
}

interface UniverseText {
  /** Short name on the dial and the card. */
  name: LocalizedText;
  /** When it is (or what changes), under the name. */
  when: LocalizedText;
  /** Honesty label: Record, Projection or What if. */
  kind: LocalizedText;
  /** One or two sentences on what the player sees and learns. */
  blurb: LocalizedText;
}

interface BlockProps {
  /** Terrain heightfield (int16 planes, from tools/pack_heightfield.py). */
  heightfieldUrl: string;
  /** Hero props GLB: stones, rift, explorer, crew echo, lighthouse, glacier (tools/export_scene.py). */
  propsModelUrl: string;
  /** Universe to start in: prime, glacial, drowned or halfg. */
  startUniverse?: string;
  /** "low" for cheaper devices (no ambient occlusion, less grass and forest). */
  quality?: "high" | "low";
  universes: {
    prime: UniverseText;
    glacial: UniverseText;
    drowned: UniverseText;
    halfg: UniverseText;
  };
  ui: {
    title: LocalizedText;
    subtitle: LocalizedText;
    riftOpensOn: LocalizedText;
    retune: LocalizedText;
    help: LocalizedText;
    paused: LocalizedText;
    error: LocalizedText;
    loading: {
      start: LocalizedText;
      fjord: LocalizedText;
      skies: LocalizedText;
      terrain: LocalizedText;
      stones: LocalizedText;
      forest: LocalizedText;
      meadow: LocalizedText;
      shaders: LocalizedText;
    };
  };
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,700&family=JetBrains+Mono:wght@400;600&display=swap";

export const Block: React.FC<BlockProps> = (props) => {
  const mexty = useMexty();
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<{ setPaused(p: boolean): void; dispose(): void } | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS;
      document.head.appendChild(link);
    }
  }, []);

  // the engine is rebuilt only when the content or the language changes
  useEffect(() => {
    const el = host.current;
    if (!el || !props.heightfieldUrl || !props.propsModelUrl || !props.universes || !props.ui) return;
    const text = resolveText({ universes: props.universes, ui: props.ui }, lang);
    const mv = startMultiverse(el, {
      assets: { heightfield: props.heightfieldUrl, props: props.propsModelUrl },
      text,
      quality: props.quality === "low" ? "low" : "high",
      start: props.startUniverse,
      onReady: () => mexty.ready(),
      onError: () => mexty.ready(),
      onTravel: (_u: object, visited: number) => {
        // each new universe reached is a level; visiting all four completes the round
        mexty.progress.level(visited);
        if (visited >= 4 && !done.current) {
          done.current = true;
          mexty.progress.complete(4, 4);
        }
      },
    });
    engine.current = mv;
    mv.setPaused(!!mexty.paused);
    return () => {
      mv.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.heightfieldUrl, props.propsModelUrl, props.startUniverse, props.quality, props.universes, props.ui, lang]);

  useEffect(() => {
    engine.current?.setPaused(!!mexty.paused);
  }, [mexty.paused]);

  return <div ref={host} style={{ position: "relative", width: "100vw", height: "100vh", background: "#07090a" }} />;
};
