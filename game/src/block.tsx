import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSave, useLanguage, useMexty, pickLanguage } from "@mexty/sdk";
import { useGLTF, useProgress } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GameCanvas } from "./scene/GameCanvas";
import { Start } from "./ui/Start";
import { Hud } from "./ui/Hud";
import { Sky } from "./ui/Sky";
import { InfoCard, CardState } from "./ui/Cards";
import { createGame, Game, Target } from "./game/state";
import { sound } from "./audio";
import { useSettings } from "./settings";
import { makeNickname } from "./game/nickname";
import { openPresence, Presence, roomForAge } from "./game/net";
import "./game.css";

/** Only the languages this game ships. */
export interface LocalizedText {
  en?: string;
  fr?: string;
}

/** A shipped idea, hung as a lantern on the Idea Tree. Credited by generated nickname only. */
export interface Lantern {
  nickname: string;
  title: LocalizedText;
  /** District id: idea-grove | biome-frontier | chrono-quarter | skyharbor | anywhere */
  where: string;
  /** ISO date the idea was built into the world. */
  shippedAt: string;
}

/** A district of the world: its stall in the Grove shows "Coming soon" with its concept art. */
export interface District {
  id: string;
  name: LocalizedText;
  teaser: LocalizedText;
  /** What players will learn there. */
  learns: LocalizedText;
  imageUrl: string;
  imageAlt: LocalizedText;
}

export interface DistrictName {
  id: string;
  name: LocalizedText;
}

export interface Star {
  /** Position in the telescope view, 0..100 both ways. */
  x: number;
  y: number;
  /** Drawn size (brighter stars are bigger). */
  size: number;
}

/** A real constellation to find through the telescope. */
export interface Constellation {
  id: string;
  name: LocalizedText;
  /** How to spot its shape, for a child. */
  hint: LocalizedText;
  /** A true fact shown once it is found. */
  fact: LocalizedText;
  stars: Star[];
  /** Pairs of star indexes joined by a line once found. */
  lines: number[][];
}

/** A preset phrase or emote of the phrase wheel (no free text between players). */
export interface Phrase {
  id: string;
  icon: string;
  text: LocalizedText;
  /** Avatar animation played with it: none | wave | cheer */
  anim: string;
}

/** An avatar preset: colours applied to the one rigged base model. */
export interface AvatarPreset {
  id: string;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  bag: string;
}

export interface Models {
  tree: string;
  forestTree: string;
  lantern: string;
  plaza: string;
  stallBiome: string;
  stallChrono: string;
  stallSky: string;
  telescope: string;
  boulders: string;
  fern: string;
  flowers: string;
  grassTuft: string;
  avatar: string;
}

export interface Textures {
  grass: string;
  dirt: string;
}

export interface Sounds {
  ambience: string;
  chime: string;
  pop: string;
  success: string;
}

export interface UiText {
  title: LocalizedText;
  tagline: LocalizedText;
  loading: LocalizedText;
  chooseLook: LocalizedText;
  yourName: LocalizedText;
  newName: LocalizedText;
  enter: LocalizedText;
  howToKeys: LocalizedText;
  howToTouch: LocalizedText;
  ideaBy: LocalizedText;
  livesIn: LocalizedText;
  builtOn: LocalizedText;
  lanternCount: LocalizedText;
  noLanterns: LocalizedText;
  readLantern: LocalizedText;
  look: LocalizedText;
  comingSoon: LocalizedText;
  comingSoonText: LocalizedText;
  youWillLearn: LocalizedText;
  close: LocalizedText;
  telescope: LocalizedText;
  useTelescope: LocalizedText;
  skyTitle: LocalizedText;
  skyFind: LocalizedText;
  skyTapHint: LocalizedText;
  skyTryAgain: LocalizedText;
  skyFound: LocalizedText;
  skyNext: LocalizedText;
  skyShowMe: LocalizedText;
  skyDone: LocalizedText;
  skyAgain: LocalizedText;
  skyProgress: LocalizedText;
  say: LocalizedText;
  settings: LocalizedText;
  quality: LocalizedText;
  qualityAuto: LocalizedText;
  qualityLow: LocalizedText;
  qualityMedium: LocalizedText;
  qualityHigh: LocalizedText;
  sound: LocalizedText;
  on: LocalizedText;
  off: LocalizedText;
  changeExplorer: LocalizedText;
  explorersHere: LocalizedText;
  aloneHere: LocalizedText;
  roomNote: LocalizedText;
  hidePlayer: LocalizedText;
  showPlayer: LocalizedText;
  paused: LocalizedText;
  lookLabel: LocalizedText;
  loadError: LocalizedText;
  retry: LocalizedText;
}

export interface BlockProps {
  ui: UiText;
  /** Shipped ideas: one lantern each on the Idea Tree. */
  lanterns: Lantern[];
  /** The three districts still being built (stalls). */
  districts: District[];
  /** Names of every district id (for lantern cards). */
  districtNames: DistrictName[];
  constellations: Constellation[];
  phrases: Phrase[];
  avatars: AvatarPreset[];
  /** English words for generated nicknames "<Adjective> <Animal> <NN>". */
  nicknameAdjectives: string[];
  nicknameAnimals: string[];
  models: Models;
  textures: Textures;
  sounds: Sounds;
}

/** Catches a model or texture that could not load, so the child sees a kind message and a retry button. */
class LoadGuard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
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

export type T = (x: LocalizedText | string | undefined, vars?: Record<string, string | number>) => string;

interface ExplorerSave {
  avatar: number;
  nickname: string;
  /** Constellation ids found at least once. */
  found: string[];
}

const EMPTY_SAVE: ExplorerSave = { avatar: 0, nickname: "", found: [] };

function apiOrigin(models: Partial<Models> | undefined): string {
  for (const u of Object.values(models || {})) {
    try {
      const o = new URL(String(u)).origin;
      if (o !== window.location.origin) return o;
    } catch {
      /* relative URL (local test) */
    }
  }
  return "";
}

export const Block: React.FC<Partial<BlockProps>> = (raw) => {
  const props = raw as BlockProps;
  const ready = !!(props.ui && props.models && props.textures);
  const mexty = useMexty();
  const lang = useLanguage();
  const settings = useSettings();
  const t: T = useCallback(
    (x, vars) => {
      let s = x == null ? "" : typeof x === "string" ? x : pickLanguage(x, lang.language, lang.defaultLanguage || "en");
      if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    },
    [lang.language, lang.defaultLanguage],
  );
  const save = useCloudSave<ExplorerSave>("explorer", EMPTY_SAVE);
  const saved = save.value || EMPTY_SAVE;
  const avatars = props.avatars || [];
  const [avatar, setAvatar] = useState(0);
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<"start" | "play">("start");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [card, setCard] = useState<CardState | null>(null);
  const [skyOpen, setSkyOpen] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ online: boolean; reason: string }>({ online: false, reason: "" });
  const game = useMemo<Game>(() => createGame(), []);
  // local testing hook (never on the store's domains)
  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) (window as unknown as { __owGame: Game }).__owGame = game;
  const { progress } = useProgress();
  const shown = useRef(0);
  shown.current = Math.max(shown.current, Math.min(99, Math.round(progress)));
  const words = { adj: props.nicknameAdjectives || [], animals: props.nicknameAnimals || [] };

  // the first screen is our own loader: the store's can go
  useEffect(() => {
    mexty.ready();
  }, [mexty]);

  // the saved explorer (or a fresh name) once the save has loaded
  const took = useRef(false);
  useEffect(() => {
    if (save.loading || took.current) return;
    took.current = true;
    setAvatar(Math.min(Math.max(0, saved.avatar || 0), Math.max(0, avatars.length - 1)));
    setNickname(saved.nickname || makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.loading]);
  useEffect(() => {
    if (!nickname && words.adj.length && words.animals.length && took.current) setNickname(makeNickname(words.adj, words.animals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.adj.length, words.animals.length]);

  game.avatar = avatar;
  game.nickname = nickname;

  // sound: the store's mute and pause win; sounds come from props
  useEffect(() => {
    if (props.sounds) sound.configure(props.sounds);
  }, [props.sounds]);
  useEffect(() => sound.setMuted(!settings.sound || !!mexty.muted), [settings.sound, mexty.muted]);
  useEffect(() => sound.suspend(!!mexty.paused), [mexty.paused]);
  useEffect(() => {
    game.paused = !!mexty.paused;
  }, [mexty.paused, game]);

  // presence: one room per EdVerse age tile, opened once the player enters the grove
  const api = useMemo(() => apiOrigin(props.models), [props.models]);
  useEffect(() => {
    if (phase !== "play") return;
    let alive = true;
    let pr: Presence | null = null;
    mexty
      .getPlayer()
      .then((p) => {
        const room = roomForAge(p.ageMin, p.ageMax);
        if (!room) {
          if (alive) setRoomInfo({ online: false, reason: "age" });
          return null;
        }
        return openPresence(room, api, game);
      })
      .then((x) => {
        if (!x) return;
        if (!alive) {
          x.close();
          return;
        }
        pr = x;
        setPresence(x);
        setRoomInfo({ online: true, reason: "" });
      })
      .catch(() => alive && setRoomInfo({ online: false, reason: "offline" }));
    return () => {
      alive = false;
      if (pr) pr.close();
      setPresence(null);
    };
  }, [phase, api, game, mexty]);

  const enter = () => {
    sound.unlock();
    sound.startAmbience();
    save.save({ ...saved, avatar, nickname });
    game.mode = "play";
    setPhase("play");
    try {
      mexty.gameplayStart();
    } catch {
      /* outside EdVerse */
    }
  };
  const backToStart = () => {
    game.mode = "start";
    setPhase("start");
    setCard(null);
    setSkyOpen(false);
  };

  const open = useCallback(
    (c: CardState) => {
      if (game.mode !== "play") return;
      if (c.kind === "telescope") {
        setSkyOpen(true);
        sound.sfx("chime", 0.7);
      } else {
        setCard(c);
        sound.sfx(c.kind === "lantern" ? "chime" : "pop", 0.8);
      }
    },
    [game],
  );
  // the HUD's action button opens the nearest thing (same as tapping it in the world)
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<Target>).detail;
      if (!f) return;
      if (f.kind === "lantern") open({ kind: "lantern", index: f.ref as number, empty: (f.ref as number) >= (props.lanterns || []).length });
      else if (f.kind === "stall") open({ kind: "stall", district: String(f.ref) });
      else open({ kind: "telescope" });
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [open, props.lanterns]);

  const onFound = (id: string) => {
    if (saved.found.indexOf(id) < 0) save.save({ ...saved, avatar, nickname, found: saved.found.concat(id) });
  };

  if (!ready) return <div className="ow-root ow-empty">EdVerse OpenWorld</div>;

  return (
    <div className="ow-root" onPointerDown={() => sound.unlock()}>
      <LoadGuard key={attempt} onError={() => setFailed(true)}>
      <GameCanvas
        props={props}
        game={game}
        settings={settings}
        paused={!!mexty.paused}
        onLoaded={() => setLoaded(true)}
        onOpen={open}
      />
      </LoadGuard>
      {failed && (
        <div className="ow-loading">
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>{t(props.ui.loadError)}</div>
          <button
            className="ow-btn"
            onClick={() => {
              // forget the failed downloads, then build the grove again
              Object.values(props.models).forEach((u) => useGLTF.clear(u));
              try {
                useLoader.clear(THREE.TextureLoader, [props.textures.grass, props.textures.dirt]);
              } catch {
                /* not cached */
              }
              setFailed(false);
              setLoaded(false);
              setAttempt((a) => a + 1);
            }}
          >
            🔁 {t(props.ui.retry)}
          </button>
        </div>
      )}
      {!loaded && !failed && (
        <div className="ow-loading">
          <div className="ow-lantern-spin" />
          <div className="ow-loading-title">{t(props.ui.title)}</div>
          <div>
            {t(props.ui.loading)} {shown.current}%
          </div>
          <div className="ow-bar">
            <i style={{ width: shown.current + "%" }} />
          </div>
        </div>
      )}
      {loaded && phase === "start" && (
        <Start
          ui={props.ui}
          t={t}
          avatars={avatars}
          avatar={avatar}
          nickname={nickname}
          onAvatar={(i) => {
            setAvatar(i);
            game.emote("cheer");
            sound.unlock();
            sound.sfx("pop", 0.6);
          }}
          onReroll={() => {
            setNickname(makeNickname(words.adj, words.animals, nickname));
            sound.unlock();
            sound.sfx("pop", 0.5);
          }}
          onEnter={enter}
        />
      )}
      {loaded && phase === "play" && (
        <Hud
          props={props}
          t={t}
          game={game}
          presence={presence}
          roomInfo={roomInfo}
          blocked={!!card || skyOpen || !!mexty.paused}
          onBack={backToStart}
          found={saved.found.length}
        />
      )}
      {card && <InfoCard card={card} props={props} t={t} language={lang.language} onClose={() => setCard(null)} />}
      {skyOpen && (
        <Sky
          ui={props.ui}
          t={t}
          constellations={props.constellations || []}
          onFound={onFound}
          onClose={() => setSkyOpen(false)}
          paused={!!mexty.paused}
        />
      )}
      {mexty.paused && loaded && <div className="ow-paused">{t(props.ui.paused)}</div>}
    </div>
  );
};
