// The Biome Frontier's DOM overlay: the fossil dig (in the canyon, tap the oldest rock layer, then the
// fossils from oldest to youngest — deeper layers are older; every answer -> mexty.progress.answer), the
// field station board and the area signs. The creatures are found and photographed with the hub's
// expedition tools (ui/Expedition.tsx); this district's chip shows the Field Guide's progress.
// Picture mode for ages 4-6. No timer, no lives.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMexty } from "@mexty/sdk";
import type { ExpeditionProps, Fossil, T } from "../../block";
import type { Game } from "../../game/state";
import { useExp } from "../../game/expedition";
import { guideScore, guideTotal } from "../../game/quests";
import { sound } from "../../audio";
import type { BiomeFrontierProps } from "./types";
import { KIND } from "./Scene";
import { DIG_LAYERS, digDone, digOrder, exposedFossil, useSurvey } from "./store";
import { digStroke } from "./dig";
import { DIG_BLOCK, DIG_STAND, landHeight } from "./layout";
import "./activity.css";

type Mexty = ReturnType<typeof useMexty>;

function answer(mexty: Mexty, questionId: string, question: string, correct: boolean, attempt: number) {
  try {
    mexty.progress.answer({ questionId, question, correct, attempt });
  } catch {
    /* outside EdVerse */
  }
}

function ModeToggle({ props, t }: { props: BiomeFrontierProps; t: T }) {
  const easy = useSurvey((s) => s.easy);
  const setEasy = useSurvey((s) => s.setEasy);
  return (
    <div className="bf-mode" role="group" aria-label={t(props.ui.modeLabel)}>
      <button className={easy ? "on" : ""} onClick={() => setEasy(true)} aria-pressed={easy}>
        🐣 {t(props.ui.easyMode)}
      </button>
      <button className={!easy ? "on" : ""} onClick={() => setEasy(false)} aria-pressed={!easy}>
        🦉 {t(props.ui.explorerMode)}
      </button>
    </div>
  );
}

function Head({ icon, title, props, t, onClose }: { icon: string; title: string; props: BiomeFrontierProps; t: T; onClose: () => void }) {
  return (
    <div className="bf-head">
      <div className="bf-title">
        <span aria-hidden>{icon}</span> {title}
      </div>
      <button className="ow-round ow-close" aria-label={t(props.ui.close)} onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ 2. the real dig
function Pic({ url, icon, cls }: { url: string; icon: string; cls?: string }) {
  const [bad, setBad] = useState(false);
  if (url && !bad) return <img className={cls} src={url} alt="" draggable={false} onError={() => setBad(true)} crossOrigin={/mexty\.ai|mext\.app/.test(url) ? "use-credentials" : undefined} />;
  return (
    <span className={cls} aria-hidden>
      {icon}
    </span>
  );
}

/** The dig's timeline: today at the top, each fossil found placed by its age; the slots fill in as you dig down. */
function Timeline({ props, t, fossils, found }: { props: BiomeFrontierProps; t: T; fossils: Fossil[]; found: string[] }) {
  const ui = props.ui;
  const max = Math.max(1, ...fossils.map((f) => f.ageMyr));
  return (
    <div className="bf-timeline ow-card" aria-label={t(ui.timeline)}>
      <div className="bf-tl-title">🕰️ {t(ui.timeline)}</div>
      <div className="bf-tl-track">
        <div className="bf-tl-line" aria-hidden />
        <div className="bf-tl-now">{t(ui.timelineNow)}</div>
        {fossils.map((f, i) => {
          const on = found.indexOf(f.id) >= 0;
          // spread by age (a square root keeps the young ones apart), never overlapping
          const y = Math.max((i + 1) * 15, 12 + Math.sqrt(f.ageMyr / max) * 82);
          return (
            <div key={f.id} className={"bf-tl-item" + (on ? " on" : "")} style={{ top: Math.min(y, 96) + "%", ["--x" as string]: 12 + (i * 76) / Math.max(1, fossils.length - 1) + "%" } as React.CSSProperties}>
              <span className="bf-tl-dot" aria-hidden />
              {on ? (
                <>
                  <Pic url={f.iconUrl} icon={f.icon} cls="bf-tl-pic" />
                  <span className="bf-tl-text">
                    <b>{t(f.name)}</b>
                    <small>{t(ui.mya, { n: f.ageMyr })}</small>
                  </span>
                </>
              ) : (
                <span className="bf-tl-text unknown">?</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dig({ props, exp, t, game, onClose }: { props: BiomeFrontierProps; exp?: ExpeditionProps; t: T; game?: Game; onClose: () => void }) {
  const mexty = useMexty();
  const ui = props.ui;
  const easy = useSurvey((s) => s.easy);
  const dig = useSurvey((s) => s.dig);
  const setDig = useSurvey((s) => s.setDig);
  const newDig = useSurvey((s) => s.newDig);
  const save = useExp((s) => s.save);
  const fossils = useMemo(() => digOrder(props.fossils || []), [props.fossils]);
  const hasTools = save.tools.indexOf("trowel") >= 0 && save.tools.indexOf("brush") >= 0;
  const toolOf = (id: string) => ((exp && exp.tools) || []).find((x) => x.id === id);
  // the camera comes close to the dig block, the explorer kneels in front of it
  useEffect(() => {
    if (!game) return;
    game.walkTo = null;
    game.me.x = DIG_STAND.x;
    game.me.z = DIG_STAND.z;
    game.me.ry = Math.atan2(DIG_BLOCK.x - DIG_STAND.x, DIG_BLOCK.z - DIG_STAND.z);
    const s = DIG_BLOCK.s || 1;
    game.cam.focus = { x: DIG_BLOCK.x, y: landHeight(DIG_BLOCK.x, DIG_BLOCK.z) + 0.75 * s, z: DIG_BLOCK.z, d: 2.2 * s };
    return () => {
      game.cam.focus = null;
    };
  }, [game]);
  // the learning record: each fossil found (first try = no trowel on it), the round when all are out
  const told = useRef<Set<string>>(new Set(dig.found));
  const finished = useRef(digDone(dig, fossils));
  useEffect(() => {
    for (const id of dig.found) {
      if (told.current.has(id)) continue;
      told.current.add(id);
      const f = fossils.find((x) => x.id === id);
      const slips = dig.slips[id] || 0;
      if (f) answer(mexty, "biome-frontier:dig:" + id, t(f.name) + " — " + t(f.age), slips === 0, slips + 1);
    }
    if (!finished.current && digDone(dig, fossils)) {
      finished.current = true;
      const score = fossils.filter((f) => !(dig.slips[f.id] || 0)).length;
      try {
        mexty.progress.complete(score, fossils.length);
      } catch {
        /* outside EdVerse */
      }
      useExp.getState().emit({ kind: "dig", id: "fossils", zone: "biome-frontier" });
    }
  }, [dig, fossils, mexty, t]);
  // Space: one stroke of the tool in hand (the same as rubbing)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !hasTools) return;
      e.preventDefault();
      if (useSurvey.getState().dig.card) setDig({ card: null });
      else digStroke(fossils, "auto", 0.34);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fossils, hasTools, setDig]);
  const ex = exposedFossil(dig, fossils);
  const done = digDone(dig, fossils);
  const card = dig.card ? fossils.find((f) => f.id === dig.card) : null;
  const hint =
    dig.msg === "useBrush" ? ui.useBrush : dig.msg === "useTrowel" ? ui.useTrowel : dig.msg === "brushFirst" ? ui.brushFirst : ex ? ui.brushHint : ui.trowelHint;
  const kind = dig.msg === "useBrush" || dig.msg === "useTrowel" || dig.msg === "brushFirst";
  const toolBtn = (id: "trowel" | "brush") => {
    const tl = toolOf(id);
    return (
      <button key={id} className={"bf-tool" + (dig.tool === id ? " on" : "")} aria-pressed={dig.tool === id} onClick={() => setDig({ tool: id, msg: "" })}>
        <Pic url={tl ? tl.iconUrl : ""} icon={id === "trowel" ? "🔨" : "🖌️"} cls="bf-tool-pic" />
        <span>{t(id === "trowel" ? ui.trowel : ui.brush)}</span>
      </button>
    );
  };
  return (
    <>
      <Timeline props={props} t={t} fossils={fossils} found={dig.found} />
      <div className="ow-card bf-digbar" role="dialog" aria-label={t(ui.digTitle)}>
        <Head icon="⛏️" title={t(ui.digTitle)} props={props} t={t} onClose={onClose} />
        {!hasTools ? (
          <p className="bf-q">{t(ui.digNeedTools)}</p>
        ) : done && !card ? (
          <div className="bf-good">
            <b>🏅 {t(ui.digDone)}</b>
            <p>{t(ui.deeperOlder)}</p>
            <p>{t(easy ? props.layersFactEasy : props.layersFact)}</p>
            <div className="ow-row">
              <button
                className="ow-btn ow-btn-small"
                onClick={() => {
                  newDig();
                  sound.sfx("chime", 0.6);
                }}
              >
                🔁 {t(ui.digAgain)}
              </button>
              <button className="ow-btn ow-btn-small" onClick={onClose} autoFocus>
                {t(ui.close)}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bf-dig-row">
              <div className="bf-tools" role="group">
                {toolBtn("trowel")}
                {toolBtn("brush")}
              </div>
              <button className="ow-btn bf-stroke" onClick={() => digStroke(fossils, "auto", 0.34)} aria-label={t(dig.tool === "trowel" ? ui.trowel : ui.brush)}>
                {dig.tool === "trowel" ? "🔨" : "🖌️"}
              </button>
            </div>
            <div className={kind ? "bf-kind" : "bf-q strong"} aria-live="polite">
              {dig.msg === "layerGone" && !ex ? t(ui.layerGone, { n: dig.removed }) + " " : ""}
              {t(hint)}
            </div>
            <div className="bf-layers" aria-hidden>
              {Array.from({ length: DIG_LAYERS }, (_, i) => (
                <i key={i} className={i < dig.removed ? "gone" : i === dig.removed ? "now" : ""} style={{ ["--p" as string]: i === dig.removed ? dig.scrape : i < dig.removed ? 1 : 0 } as React.CSSProperties} />
              ))}
            </div>
          </>
        )}
      </div>
      {card && (
        <div className="ow-modal bf-modal" onPointerDown={(e) => e.target === e.currentTarget && setDig({ card: null })}>
          <div className="ow-card bf-panel bf-fossil-card" role="dialog" aria-modal="true">
            <div className="bf-fossil-head">
              <Pic url={card.iconUrl} icon={card.icon} cls="bf-fossil-pic" />
              <div>
                <div className="bf-q">✨ {t(ui.fossilFound)}</div>
                <h2 className="bf-name">{t(card.name)}</h2>
                <div className="bf-q strong">
                  {t(card.age)} · {t(card.period)}
                </div>
              </div>
            </div>
            <p className="bf-about">{t(easy ? card.factEasy : card.fact)}</p>
            <div className="ex-source">{exp ? t(exp.ui.source, { source: card.source }) : card.source}</div>
            <button className="ow-btn ow-btn-go" autoFocus onClick={() => setDig({ card: null, msg: "" })}>
              {t(ui.next)} ➜
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ 3. the field station board (dig, Field Guide)
function Station({ props, exp, t, onClose }: { props: BiomeFrontierProps; exp: ExpeditionProps | undefined; t: T; onClose: () => void }) {
  const ui = props.ui;
  const dig = useSurvey((s) => s.dig);
  const newDig = useSurvey((s) => s.newDig);
  const save = useExp((s) => s.save);
  const hasGuide = save.tools.indexOf("guide") >= 0;
  const dug = digDone(dig, props.fossils || []);
  const total = guideTotal(exp && exp.species);
  const species = exp && exp.species;
  return (
    <div className="ow-card bf-panel" role="dialog" aria-modal="true">
      <Head icon="🏕️" title={t(ui.stationTitle)} props={props} t={t} onClose={onClose} />
      {exp && <p className="bf-q">{t(exp.ui.stationIntro)}</p>}
      <div className="bf-grid">
        <div className={"bf-slot dig" + (dug ? " done" : "")}>
          <span className="bf-slot-icon">⛏️</span>
          <span className="bf-slot-name">{dug ? t(ui.digDone) : t(ui.digWaiting)}</span>
        </div>
        {exp && (
          <button
            className={"bf-slot" + (hasGuide ? " done" : "")}
            disabled={!hasGuide}
            onClick={() => {
              onClose();
              useExp.setState({ mode: "guide", page: null });
            }}
          >
            <span className="bf-slot-icon">📖</span>
            <span className="bf-slot-name">{t(exp.ui.guideChip, { n: guideScore(save, species), total })}</span>
          </button>
        )}
      </div>
      <ModeToggle props={props} t={t} />
      <div className="ow-row">
        {dug && (
          <button
            className="ow-btn ow-btn-small"
            onClick={() => {
              newDig();
              sound.sfx("chime", 0.6);
            }}
          >
            🔁 {t(ui.playAgain)}
          </button>
        )}
        <button className="ow-btn ow-btn-small" onClick={onClose}>
          {t(ui.close)}
        </button>
      </div>
    </div>
  );
}

function Sign({ props, t, biome, onClose }: { props: BiomeFrontierProps; t: T; biome: string; onClose: () => void }) {
  const b = (props.biomes || []).find((x) => x.id === biome);
  if (!b) return null;
  return (
    <div className="ow-card bf-panel bf-sign" role="dialog" aria-modal="true" style={{ ["--bf-c" as string]: b.color } as React.CSSProperties}>
      <div className="bf-sign-icon" aria-hidden>
        {b.icon}
      </div>
      <h2 className="bf-name cap">{t(b.name)}</h2>
      <p className="bf-about">{t(b.about)}</p>
      <button className="ow-btn ow-btn-go" onClick={onClose} autoFocus>
        {t(props.ui.close)}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ the overlay
export function Activity({ props, expedition, t, paused, onBusy, game }: { props: BiomeFrontierProps; expedition?: ExpeditionProps; t: T; paused?: boolean; onBusy?: (busy: boolean) => void; game?: Game }) {
  const mexty = useMexty();
  const view = useSurvey((s) => s.view);
  const open = useSurvey((s) => s.open);
  const close = useSurvey((s) => s.close);
  const dig = useSurvey((s) => s.dig);
  const easyChosen = useSurvey((s) => s.easyChosen);
  const setEasy = useSurvey((s) => s.setEasy);
  const save = useExp((s) => s.save);
  const hasGuide = save.tools.indexOf("guide") >= 0;
  const total = guideTotal(expedition && expedition.species);
  const dug = digDone(dig, props.fossils || []);
  // local testing hook (never on the store's domains)
  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) (window as unknown as Record<string, unknown>).__owSurvey = useSurvey;

  useEffect(() => onBusy && onBusy(!!view), [view, onBusy]);

  // the youngest explorers start in picture mode (they can switch)
  useEffect(() => {
    let alive = true;
    mexty
      .getPlayer()
      .then((p: { ageMax?: number | null }) => {
        if (alive && !easyChosen && p && typeof p.ageMax === "number" && p.ageMax <= 6) setEasy(true, false);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mexty]);

  // the hub's action button (and E / Enter) opens the nearest district target
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<{ kind: string; ref: string | number }>).detail;
      if (!f || typeof f.kind !== "string" || f.kind.indexOf("biome-frontier:") !== 0) return;
      if (f.kind === KIND.dig) open({ kind: "dig" });
      else if (f.kind === KIND.station) open({ kind: "station" });
      else if (f.kind === KIND.sign) open({ kind: "sign", biome: String(f.ref) });
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [open]);

  useEffect(() => {
    if (view) sound.sfx(view.kind === "sign" ? "pop" : "chime", 0.6);
  }, [view]);

  const esc = useRef(close);
  esc.current = close;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.code === "Escape" && esc.current();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      <button
        className="bf-chip"
        onClick={() => (hasGuide ? useExp.setState({ mode: "guide", page: null }) : open({ kind: "station" }))}
        aria-label={expedition ? t(expedition.ui.guide) : t(props.ui.stationTitle)}
      >
        {expedition && <span>📖 {t(expedition.ui.guideChip, { n: guideScore(save, expedition.species), total })}</span>}
        <span className={dug ? "ok" : ""}>⛏️ {dug ? "✓" : "…"}</span>
      </button>
      {view && view.kind === "dig" && !paused && <Dig key={dig.id} props={props} exp={expedition} t={t} game={game} onClose={close} />}
      {view && view.kind !== "dig" && !paused && (
        <div className="ow-modal bf-modal" onPointerDown={(e) => e.target === e.currentTarget && view.kind === "sign" && close()}>
          {view.kind === "station" && <Station props={props} exp={expedition} t={t} onClose={close} />}
          {view.kind === "sign" && <Sign props={props} t={t} biome={view.biome} onClose={close} />}
        </div>
      )}
    </>
  );
}
