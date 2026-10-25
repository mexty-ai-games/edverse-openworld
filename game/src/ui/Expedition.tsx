// The first expedition, DOM side: the controller (quest engine events, the cloud save, the learning
// record), the quest tracker chip, the Grove Keeper's speech bubble, the field-kit buttons and toasts.
// The tools themselves (camera, Field Guide, hand lens) are in ui/FieldKit.tsx.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSave, useMexty } from "@mexty/sdk";
import type { ExpeditionProps, GuideSpecies, KeeperLine, Quest, T } from "../block";
import type { Game } from "../game/state";
import { useExp } from "../game/expedition";
import {
  applyEvent, cleanSave, currentQuest, currentStep, EMPTY_EXP, ExpSave, guideScore, guideTotal, Outcome, QuestEvent, STAGE, stagesOf, startExpedition, startTools,
} from "../game/quests";
import { KEEPER, SPARKS } from "../game/layout";
import { sound } from "../audio";
import { CameraView, FieldGuide, LensPanel, PhotoCard } from "./FieldKit";
import { JarCard, NetView } from "./Catch";
import "./expedition.css";

type Mexty = ReturnType<typeof useMexty>;

const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const STAGE_NAMES: [number, keyof ExpeditionProps["ui"]][] = [
  [STAGE.seen, "stageSeen"],
  [STAGE.photo, "stagePhoto"],
  [STAGE.id, "stageId"],
  [STAGE.behaviour, "stageBehaviour"],
  [STAGE.released, "stageReleased"],
  [STAGE.measured, "stageMeasured"],
];

function answer(mexty: Mexty, questionId: string, question: string, correct: boolean, attempt: number) {
  try {
    mexty.progress.answer({ questionId, question, correct, attempt });
  } catch {
    /* outside EdVerse */
  }
}

export interface ExpeditionApi {
  exp: ExpeditionProps;
  quests: Quest[];
  t: T;
  game: Game;
  young: boolean;
  species: (id: string) => GuideSpecies | undefined;
  /** Fill a Field Guide stage (once): the learning record gets a correct answer. Returns true if new. */
  addStage: (speciesId: string, bit: number) => boolean;
  emit: (ev: QuestEvent) => void;
  zone: string;
  mexty: Mexty;
  playLine: (lineId: string) => void;
}

/** The step text with its counters. */
export function stepText(t: T, quests: Quest[], save: ExpSave): { icon: string; text: string; line?: string } | null {
  const q = currentQuest(quests, save);
  const st = currentStep(quests, save);
  if (!q || !st) return null;
  return { icon: st.icon || q.icon, text: t(st.text, { n: save.p.length, count: st.count }), line: st.line };
}

export function Expedition({ exp, quests, t, game, zone, phase, young, blocked, onBusy }: {
  exp: ExpeditionProps;
  quests: Quest[];
  t: T;
  game: Game;
  zone: string;
  /** The world is on screen (not the start screen). */
  phase: "start" | "play";
  young: boolean;
  /** Another card or activity is open. */
  blocked: boolean;
  /** A field-kit panel is open (the hub's HUD steps back). */
  onBusy: (busy: boolean) => void;
}) {
  const mexty = useMexty();
  const cloud = useCloudSave<ExpSave>("expedition", EMPTY_EXP);
  const save = useExp((s) => s.save);
  const loaded = useExp((s) => s.loaded);
  const dialogue = useExp((s) => s.dialogue);
  const mode = useExp((s) => s.mode);
  const photo = useExp((s) => s.photo);
  const lensOn = useExp((s) => s.lensOn);
  const toast = useExp((s) => s.toast);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const ui = exp.ui;

  // ---------------------------------------------------------------- the save: load once, then mirror changes
  const lastWritten = useRef<ExpSave | null>(null);
  const ahead = useRef<QuestEvent[]>([]);
  const migrated = useRef(false);
  useEffect(() => {
    if (cloud.loading || useExp.getState().loaded) return;
    const clean = cleanSave(cloud.value);
    lastWritten.current = clean;
    // a save from before the newest quests: the quest it now stands on hands over its tools (and says hello)
    const mig = startTools(quests, clean);
    useExp.setState({ save: mig.save, loaded: true });
    if (mig.given.length) migrated.current = true;
  }, [cloud.loading, cloud.value]);
  useEffect(() => {
    if (!loaded || save === lastWritten.current) return;
    const id = window.setTimeout(() => {
      lastWritten.current = save;
      cloud.save(save);
    }, 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, loaded]);
  useEffect(() => {
    useExp.setState({ quests });
  }, [quests]);

  // ---------------------------------------------------------------- lines and dialogues
  const lineById = useMemo(() => {
    const m: Record<string, KeeperLine> = {};
    for (const l of exp.keeper.lines || []) m[l.id] = l;
    return m;
  }, [exp.keeper.lines]);
  const linesOf = useCallback(
    (dialogueId: string | undefined): KeeperLine[] => {
      if (!dialogueId) return [];
      const d = (exp.keeper.dialogues || []).find((x) => x.id === dialogueId);
      return d ? d.lines.map((id) => lineById[id]).filter(Boolean) : [];
    },
    [exp.keeper.dialogues, lineById],
  );
  const say = useCallback((lines: KeeperLine[], onDone?: () => void) => useExp.getState().say({ lines, index: 0, onDone }), []);
  const playLine = useCallback(
    (lineId: string) => {
      const l = lineById[lineId];
      if (l && l.audio) sound.voice([t(l.audio)]);
    },
    [lineById, t],
  );
  // each line is spoken as it shows
  const shownLine = dialogue ? dialogue.lines[dialogue.index] : null;
  useEffect(() => {
    if (shownLine && shownLine.audio) sound.voice([t(shownLine.audio)]);
  }, [shownLine, t]);

  // ---------------------------------------------------------------- rules
  const speciesById = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);
  const species = useCallback((id: string) => speciesById[id], [speciesById]);
  const total = guideTotal(exp.species);

  /** A quest marked `report` was just finished: the learning record gets the Field Guide's score. */
  const reportIfDone = useCallback(
    (s: ExpSave, q: Quest | null) => {
      if (!q || !q.report || !s.started) return s;
      const rp = s.rp || [];
      if (rp.indexOf(q.id) >= 0) return s;
      try {
        mexty.progress.complete(guideScore(s, exp.species), total);
        mexty.celebrate();
      } catch {
        /* outside EdVerse */
      }
      return { ...s, reported: true, rp: rp.concat(q.id) };
    },
    [mexty, total, exp.species],
  );

  const handle = useCallback(
    (out: Outcome) => {
      const st = useExp.getState();
      let s = out.save;
      if (out.questDone) s = reportIfDone(s, out.questDone);
      st.setSave(s);
      for (const tl of out.given) {
        const tool = (exp.tools || []).find((x) => x.id === tl);
        if (tool) st.showToast(tool.icon, t(ui.newTool, { tool: t(tool.name) }));
      }
      if (out.given.length) sound.sfx("success", 0.8);
      if (out.questDone) {
        sound.sfx("success", 0.9);
        if (!out.given.length) st.showToast(out.questDone.icon, t(ui.questDone));
        say(linesOf(out.questDone.done));
      }
      if (out.questStarted) say(linesOf(out.questStarted.intro));
      else if (out.stepsDone.length && !out.questDone) {
        // the next step of the same quest: the keeper says what to do now
        const next = currentStep(quests, s);
        if (next && next.line && lineById[next.line]) say([lineById[next.line]]);
      }
      if (out.allDone) st.showToast("🏅", t(ui.allDone));
    },
    [exp.tools, t, ui, say, linesOf, quests, lineById, reportIfDone],
  );

  const emit = useCallback(
    (ev: QuestEvent) => {
      const st = useExp.getState();
      if (!st.loaded) return;
      // finds are heard by the rest of the world too (phase 3: the BioBlitz, team-up finds, the pollinator chart)
      if (/^(photo|observe|identify|release)$/.test(ev.kind)) window.dispatchEvent(new CustomEvent("ow-find", { detail: ev }));
      const out = applyEvent(quests, st.save, ev);
      if (out.progressed) handle(out);
      else if (/^(measure|weigh|release|plant|water|pollinate|museum|sticker|coop|bioblitz|help)$/.test(ev.kind) && !ahead.current.some((e) => e.kind === ev.kind && e.id === ev.id)) ahead.current = ahead.current.concat(ev).slice(-30);
    },
    [quests, handle],
  );

  const addStage = useCallback(
    (sid: string, bit: number): boolean => {
      const st = useExp.getState();
      const s = st.save;
      const sp = speciesById[sid];
      if (!sp || stagesOf(sp).indexOf(bit) < 0) return false;
      const pg = s.g[sid] || { st: 0 };
      if (pg.st & bit) return false;
      st.setSave({ ...s, g: { ...s.g, [sid]: { ...pg, st: pg.st | bit } } });
      const stName = STAGE_NAMES.find((x) => x[0] === bit);
      answer(mexty, "guide:" + sid + ":" + (stName ? stName[1] : bit), t(sp.name) + " — " + (stName ? t(ui[stName[1]]) : ""), true, 1);
      return true;
    },
    [speciesById, mexty, t, ui],
  );

  // ---------------------------------------------------------------- the world talks to the controller
  const lastTap = useRef(0);
  useEffect(() => {
    useExp.setState({
      emit,
      seen: (sid: string) => {
        const st = useExp.getState();
        if (st.save.tools.indexOf("guide") < 0) return;
        if (addStage(sid, STAGE.seen)) {
          const sp = speciesById[sid];
          if (sp) st.showToast(sp.icon, t(ui.newPage) + " " + t(sp.name));
          sound.sfx("chime", 0.5);
        }
      },
      tapCreature: (key: string, sid: string) => {
        const now = performance.now();
        if (now - lastTap.current < 300) return;
        lastTap.current = now;
        const st = useExp.getState();
        const c = game.creatures.find((x) => x.key === key);
        if (st.mode === "lens" && c) {
          const d = Math.hypot(c.obj.position.x - game.me.x, c.obj.position.z - game.me.z);
          if (d > 5) {
            st.showToast("🔍", t(ui.lensFar));
            return;
          }
          useExp.setState({ lensOn: { key, species: sid } });
          return;
        }
        st.seen(sid);
        const sp = speciesById[sid];
        const pg = st.save.g[sid];
        if (sp && st.mode !== "camera" && st.save.tools.indexOf("guide") >= 0) st.showToast(sp.icon, pg && pg.st ? t(sp.name) : t(ui.unknown));
      },
    });
  }, [emit, addStage, speciesById, t, ui, game]);
  useEffect(() => {
    const shy = () => useExp.getState().showToast("💨", t(ui.tooShy));
    window.addEventListener("ow-shy", shy);
    return () => window.removeEventListener("ow-shy", shy);
  }, [t, ui]);

  // the keeper and the glowing seeds (tap, the HUD's action button, or walking up to the keeper)
  const pending = useRef<{ kind: string; ref: string } | null>(null);
  const talk = useCallback(() => {
    const st = useExp.getState();
    if (st.dialogue) return;
    if (!st.save.started) {
      handle(startExpedition(quests, st.save, zoneRef.current));
      return;
    }
    const step = currentStep(quests, st.save);
    if (step && step.kind === "talk" && step.target === "keeper") {
      say(linesOf(step.dialogue), () => emit({ kind: "talk", id: "keeper", zone: zoneRef.current }));
      return;
    }
    const lines: KeeperLine[] = [];
    if (step && step.line && lineById[step.line]) lines.push(lineById[step.line]);
    else if (lineById.allDone2 || lineById.allDone) lines.push(lineById.allDone2 || lineById.allDone);
    say(lines);
  }, [quests, handle, say, linesOf, emit, lineById]);
  const pickSpark = useCallback(
    (id: string) => {
      const st = useExp.getState();
      const before = st.save.p.length;
      emit({ kind: "find", id, zone: zoneRef.current });
      const after = useExp.getState().save;
      const step = currentStep(quests, after);
      if (after.p.length > before || (step && step.kind !== "find")) {
        sound.sfx("chime", 0.9);
        st.showToast("✨", t(ui.sparkFound, { n: Math.min(SPARKS.length, before + 1), total: SPARKS.length }));
      }
    },
    [emit, quests, t, ui],
  );
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<{ kind: string; ref: string | number; x: number; z: number; reach: number }>).detail;
      if (!f || (f.kind !== "keeper" && f.kind !== "spark") || game.mode !== "play") return;
      const d = Math.hypot(f.x - game.me.x, f.z - game.me.z);
      if (d <= f.reach + 0.5) {
        if (f.kind === "keeper") talk();
        else pickSpark(String(f.ref));
      } else {
        // far away: walk there first
        const k = (d - 1.4) / d;
        game.walkTo = { x: game.me.x + (f.x - game.me.x) * k, z: game.me.z + (f.z - game.me.z) * k };
        pending.current = { kind: f.kind, ref: String(f.ref) };
      }
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [game, talk, pickSpark]);
  const nearKeeper = useRef(false);
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (game.mode !== "play" || zoneRef.current !== "idea-grove") return;
      const p = pending.current;
      if (p) {
        const spot = p.kind === "keeper" ? KEEPER : SPARKS.find((s) => s.id === p.ref);
        if (spot && Math.hypot(spot.x - game.me.x, spot.z - game.me.z) < 2.6) {
          pending.current = null;
          if (p.kind === "keeper") talk();
          else pickSpark(p.ref);
        } else if (!game.walkTo) pending.current = null;
      }
      // walking up to the keeper while he waits for you
      const near = Math.hypot(KEEPER.x - game.me.x, KEEPER.z - game.me.z) < 2.3;
      if (near && !nearKeeper.current) {
        const st = useExp.getState();
        const step = currentStep(quests, st.save);
        if (step && step.kind === "talk" && step.target === "keeper" && !st.dialogue) talk();
      }
      nearKeeper.current = near;
    }, 200);
    return () => window.clearInterval(iv);
  }, [game, talk, pickSpark, quests]);

  // ---------------------------------------------------------------- arriving: greet new explorers, remind returning ones
  const greeted = useRef(false);
  useEffect(() => {
    if (phase !== "play" || !loaded || greeted.current) return;
    greeted.current = true;
    const id = window.setTimeout(() => {
      const st = useExp.getState();
      if (!st.save.started) {
        if (zoneRef.current === "idea-grove") handle(startExpedition(quests, st.save, zoneRef.current));
        else greeted.current = false;
        return;
      }
      const step = currentStep(quests, st.save);
      const lines = [lineById.welcomeBack].filter(Boolean);
      const q = currentQuest(quests, st.save);
      if (migrated.current && q && q.intro) {
        // new quests since the last visit: the keeper introduces the one waiting, and hands its tools over
        migrated.current = false;
        for (const tl of q.giveAtStart) {
          const tool = (exp.tools || []).find((x) => x.id === tl);
          if (tool) st.showToast(tool.icon, t(ui.newTool, { tool: t(tool.name) }));
        }
        say(lines.concat(linesOf(q.intro)));
        return;
      }
      if (step && step.line && lineById[step.line]) lines.push(lineById[step.line]);
      say(lines);
    }, 900);
    return () => window.clearTimeout(id);
  }, [phase, loaded, quests, handle, lineById, say, linesOf, exp.tools, t, ui]);
  useEffect(() => {
    if (phase !== "play") greeted.current = false;
  }, [phase]);
  // a new zone: a visit
  useEffect(() => {
    if (phase === "play" && loaded) emit({ kind: "visit", id: zone, zone });
  }, [zone, phase, loaded, emit]);
  // closing the tools when leaving a zone or the world; a creature still in the jar goes home by itself
  useEffect(() => {
    const st = useExp.getState();
    if (st.jar) {
      const sp = speciesById[st.jar.species];
      if (sp) st.showToast(sp.icon, t(ui.wentHome, { name: t(sp.name) }));
    }
    useExp.setState({ mode: null, lensOn: null, photo: null, jar: null, jarTab: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, phase]);

  // things done ahead of their step during this visit (weighed while the measuring step was still on) count when it comes
  const stepKey = save.q + ":" + save.s;
  useEffect(() => {
    const step = currentStep(quests, useExp.getState().save);
    if (!step) return;
    for (const ev of ahead.current.filter((e) => e.kind === step.kind)) emit(ev);
  }, [stepKey, quests, emit]);

  // the camera rig follows the open tool
  useEffect(() => {
    game.cam.aim = mode === "camera" && !photo;
    if (mode !== "camera") game.cam.fov = 50;
    return () => {
      game.cam.aim = false;
    };
  }, [mode, photo, game]);
  useEffect(() => {
    if (!lensOn) game.cam.focus = null;
  }, [lensOn, game]);

  // ---------------------------------------------------------------- the HUD steps back while a panel is open
  const jarTab = useExp((s) => s.jarTab);
  const jar = useExp((s) => s.jar);
  const busy = mode === "guide" || !!lensOn || !!photo || !!jarTab;
  useEffect(() => onBusy(busy), [busy, onBusy]);

  // toasts fade
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useExp.setState({ toast: null }), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (LOCAL) (window as unknown as Record<string, unknown>).__owExp = useExp;

  const api: ExpeditionApi = { exp, quests, t, game, young, species, addStage, emit, zone, mexty, playLine };
  if (phase !== "play") return null;
  const owned = save.tools;
  const step = stepText(t, quests, save);
  const toolBtn = (id: string, onClick: () => void, on: boolean) => {
    const tool = (exp.tools || []).find((x) => x.id === id);
    if (!tool || owned.indexOf(id) < 0) return null;
    return (
      <button key={id} className={"ow-round ex-tool" + (on ? " on" : "")} aria-label={t(tool.name)} title={t(tool.name)} onClick={onClick}>
        {tool.iconUrl ? <img src={tool.iconUrl} alt="" draggable={false} /> : tool.icon}
      </button>
    );
  };
  const toggle = (m: "camera" | "lens" | "guide" | "net") => {
    sound.sfx("pop", 0.6);
    useExp.getState().setMode(mode === m ? null : m);
  };
  return (
    <>
      {step && !busy && mode !== "camera" && mode !== "net" && (
        <div className={"ex-tracker" + (blocked ? " dim" : "") + (zone !== "idea-grove" ? " low" : "")}>
          <span className="ex-tracker-icon" aria-hidden>
            {step.icon}
          </span>
          <span className="ex-tracker-text">{step.text}</span>
          {step.line && lineById[step.line] && lineById[step.line].audio && (
            <button className="ex-tracker-say" aria-label={t(ui.listen)} onClick={() => playLine(step.line!)}>
              🔈
            </button>
          )}
        </div>
      )}
      {!blocked && !busy && mode !== "camera" && (
        <div className="ex-tools">
          {toolBtn("camera", () => toggle("camera"), false)}
          {toolBtn("lens", () => toggle("lens"), mode === "lens")}
          {toolBtn("net", () => toggle("net"), mode === "net")}
          {toolBtn(
            "jar",
            () => {
              sound.sfx("pop", 0.6);
              if (useExp.getState().jar) useExp.setState({ jarTab: "look", mode: null });
              else useExp.getState().showToast("🫙", t(ui.netHint));
            },
            !!jar,
          )}
          {toolBtn("guide", () => toggle("guide"), false)}
        </div>
      )}
      {mode === "net" && !blocked && !jarTab && <NetView api={api} />}
      {jarTab && !blocked && <JarCard api={api} />}
      {mode === "lens" && !lensOn && !blocked && (
        <div className="ex-lens-hint">
          🔍 {t(ui.lensHint)}
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={() => useExp.getState().setMode(null)}>
            ✕
          </button>
        </div>
      )}
      {mode === "camera" && !photo && !blocked && <CameraView api={api} />}
      {photo && <PhotoCard api={api} />}
      {mode === "guide" && <FieldGuide api={api} />}
      {lensOn && <LensPanel api={api} />}
      {dialogue && !blocked && !busy && <SpeechBubble exp={exp} t={t} />}
      {toast && !dialogue && (
        <div className="ex-toast" key={toast.at}>
          <span aria-hidden>{toast.icon}</span> {toast.text}
        </div>
      )}
    </>
  );
}

/** The Grove Keeper's speech bubble: one line at a time, a next button, the line's voice. */
function SpeechBubble({ exp, t }: { exp: ExpeditionProps; t: T }) {
  const d = useExp((s) => s.dialogue);
  const next = useExp((s) => s.nextLine);
  if (!d) return null;
  const line = d.lines[d.index];
  const last = d.index + 1 >= d.lines.length;
  return (
    <div className="ex-bubble-wrap" role="dialog" aria-live="polite">
      <div className="ex-bubble ow-card">
        <div className="ex-portrait" aria-hidden>
          {exp.keeper.portraitUrl ? <img src={exp.keeper.portraitUrl} alt="" draggable={false} /> : exp.keeper.icon}
        </div>
        <div className="ex-bubble-body">
          <div className="ex-bubble-name">{t(exp.keeper.name)}</div>
          <div className="ex-bubble-text">{t(line.text)}</div>
        </div>
        <div className="ex-bubble-btns">
          {line.audio && (
            <button className="ow-round ex-small" aria-label={t(exp.ui.listen)} onClick={() => sound.voice([t(line.audio)])}>
              🔈
            </button>
          )}
          <button
            className="ow-btn ex-next"
            autoFocus
            onClick={() => {
              sound.sfx("pop", 0.5);
              if (last) sound.stopVoice();
              next();
            }}
          >
            {last ? "✓" : "➜"} <span className="ex-next-label">{t(last ? exp.ui.close : exp.ui.next)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
