// The Biome Frontier's DOM overlay: the fossil dig (in the canyon, tap the oldest rock layer, then the
// fossils from oldest to youngest — deeper layers are older; every answer -> mexty.progress.answer), the
// field station board and the area signs. The creatures are found and photographed with the hub's
// expedition tools (ui/Expedition.tsx); this district's chip shows the Field Guide's progress.
// Picture mode for ages 4-6. No timer, no lives.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMexty } from "@mexty/sdk";
import type { ExpeditionProps, T } from "../../block";
import { useExp } from "../../game/expedition";
import { guideScore } from "../../game/quests";
import { sound } from "../../audio";
import type { BiomeFrontierProps } from "./types";
import { KIND } from "./Scene";
import { useSurvey } from "./store";
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

// ------------------------------------------------------------------ 2. the fossil dig
/** Drawn fossil pictures (no emoji exists for a trilobite or an ammonite); the prop icon is the fallback. */
function FossilGlyph({ id, icon, x, y, r }: { id: string; icon: string; x: number; y: number; r: number }) {
  const ink = "#6b4a2e";
  const k = r / 10;
  const T = (d: string) => <path d={d} fill="none" stroke={ink} strokeWidth={1.1 * k} strokeLinecap="round" strokeLinejoin="round" />;
  if (id === "trilobite")
    return (
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        <ellipse cx="0" cy="0.5" rx="5.2" ry="6.8" fill="#9b8064" stroke={ink} strokeWidth="1" />
        <path d="M-5 -3.5 Q0 -8.5 5 -3.5" fill="#b49a7c" stroke={ink} strokeWidth="1" />
        {[-1.5, 0.5, 2.5, 4.5].map((yy) => (
          <path key={yy} d={`M-4.6 ${yy} Q0 ${yy + 1} 4.6 ${yy}`} fill="none" stroke={ink} strokeWidth="0.8" />
        ))}
        <path d="M-1.6 -3 L-1.6 6.5 M1.6 -3 L1.6 6.5" stroke={ink} strokeWidth="0.8" />
      </g>
    );
  if (id === "ammonite") {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 5;
      const rr = 0.5 * Math.exp(t * 0.2);
      pts.push(`${(Math.cos(t) * rr).toFixed(2)} ${(Math.sin(t) * rr).toFixed(2)}`);
    }
    return (
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        <circle r="7" fill="#e6d2a8" stroke={ink} strokeWidth="1" />
        <path d={"M" + pts.join(" L")} fill="none" stroke={ink} strokeWidth="1.1" />
      </g>
    );
  }
  if (id === "fern")
    return (
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        {T("M0 7 L0 -7")}
        {[-5, -2.5, 0, 2.5, 5].map((yy, i) => (
          <g key={yy}>
            {T(`M0 ${yy} Q${-3 - i * 0.2} ${yy - 1.5} ${-4.5 + i * 0.6} ${yy - 3}`)}
            {T(`M0 ${yy} Q${3 + i * 0.2} ${yy - 1.5} ${4.5 - i * 0.6} ${yy - 3}`)}
          </g>
        ))}
      </g>
    );
  if (id === "shark-tooth")
    return (
      <g transform={`translate(${x} ${y}) scale(${k})`}>
        <path d="M-5.5 5 Q0 3.5 5.5 5 L0 -7 Z" fill="#5d6470" stroke="#2f343c" strokeWidth="1" strokeLinejoin="round" />
        <path d="M-5.5 5 Q0 7.5 5.5 5" fill="#8c7a62" stroke="#2f343c" strokeWidth="0.8" />
      </g>
    );
  return (
    <text x={x} y={y + r * 0.4} className="bf-fossil-icon">
      {icon}
    </text>
  );
}

function FossilIcon({ id, icon }: { id: string; icon: string }) {
  return (
    <svg viewBox="-9 -9 18 18" width="26" height="26" aria-hidden style={{ verticalAlign: "middle" }}>
      <FossilGlyph id={id} icon={icon} x={0} y={0} r={8.5} />
    </svg>
  );
}

const LAYER_COLS = ["#5b4a63", "#8a6a3e", "#b5583a", "#e2b06a"];
const FOSSIL_X = [0.3, 0.68, 0.42, 0.74];

function Dig({ props, t, onDone, onClose }: { props: BiomeFrontierProps; t: T; onDone: () => void; onClose: () => void }) {
  const mexty = useMexty();
  const ui = props.ui;
  const easy = useSurvey((s) => s.easy);
  const round = useSurvey((s) => s.round);
  const digAnswer = useSurvey((s) => s.digAnswer);
  const fossils = useMemo(() => (props.fossils || []).slice().sort((a, b) => a.layer - b.layer), [props.fossils]);
  const layers = Math.max(1, fossils.length);
  const already = round.digAnswers >= 2;
  const [step, setStep] = useState<"oldest" | "order" | "done">(already ? "done" : round.digAnswers === 1 ? "order" : "oldest");
  const [msg, setMsg] = useState<"" | "oldWrong" | "oldRight" | "orderWrong" | "orderRight">("");
  const [missA, setMissA] = useState(0);
  const [missB, setMissB] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [hint, setHint] = useState(false);
  const tapLayer = (i: number) => {
    if (step !== "oldest") return;
    if (i === 0) {
      answer(mexty, "biome-frontier:dig-oldest", t(ui.digOldest), missA === 0, missA + 1);
      digAnswer(missA === 0);
      setMsg("oldRight");
      setStep("order");
      sound.sfx("success", 0.7);
    } else {
      setMissA((m) => m + 1);
      setMsg("oldWrong");
      sound.sfx("pop", 0.5);
    }
  };
  // the taps so far live in a ref too, so quick double taps never read a stale list
  const pickedRef = useRef<number[]>([]);
  const tapFossil = (layer: number) => {
    const cur = pickedRef.current;
    if (step !== "order" || cur.indexOf(layer) >= 0) return;
    const want = cur.length; // oldest first = layer 0, 1, 2 ...
    if (layer !== want) {
      setMissB((m) => m + 1);
      pickedRef.current = [];
      setPicked([]);
      setMsg("orderWrong");
      sound.sfx("pop", 0.5);
      return;
    }
    const next = cur.concat(layer);
    pickedRef.current = next;
    setPicked(next);
    sound.sfx("chime", 0.5);
    if (next.length >= fossils.length) {
      answer(mexty, "biome-frontier:dig-order", t(ui.digOrder), missB === 0, missB + 1);
      digAnswer(missB === 0);
      setMsg("orderRight");
      setStep("done");
      sound.sfx("success", 0.8);
    } else setMsg("");
  };
  const H = 100 / layers;
  return (
    <div className="ow-card bf-panel bf-dig" role="dialog" aria-modal="true">
      <Head icon="⛏️" title={t(ui.digTitle)} props={props} t={t} onClose={onClose} />
      <div className="bf-dig-body">
        <svg viewBox="0 0 100 100" className="bf-strata" role="img" aria-label={t(ui.digIntro)}>
          {fossils.map((f, k) => {
            const i = f.layer;
            const y = 100 - (i + 1) * H;
            const glow = (hint || missA >= 2) && step === "oldest" && i === 0;
            return (
              <g key={f.id}>
                <rect
                  x="0"
                  y={y}
                  width="100"
                  height={H}
                  fill={LAYER_COLS[i % LAYER_COLS.length]}
                  className={"bf-layer" + (step === "oldest" ? " tap" : "") + (glow ? " glow" : "")}
                  onPointerDown={() => tapLayer(i)}
                />
                <path d={`M0 ${y} Q 25 ${y - 1.5} 50 ${y} T 100 ${y}`} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" fill="none" />
                <text x="3" y={y + H / 2 + 2} className="bf-layer-label">
                  {t(ui.layerLabel, { n: layers - i })}
                </text>
                <g
                  className={"bf-fossil" + (step === "order" ? " tap" : "") + (picked.indexOf(i) >= 0 ? " picked" : "") + (step === "order" && (hint || missB >= 2) && picked.length === i ? " glow" : "")}
                  onPointerDown={() => tapFossil(i)}
                >
                  <circle cx={FOSSIL_X[k % 4] * 100} cy={y + H / 2} r={H * 0.36} fill="rgba(255,244,214,0.92)" />
                  <FossilGlyph id={f.id} icon={f.icon} x={FOSSIL_X[k % 4] * 100} y={y + H / 2} r={H * 0.27} />
                  {picked.indexOf(i) >= 0 && (
                    <text x={FOSSIL_X[k % 4] * 100 + H * 0.38} y={y + H * 0.3} className="bf-order">
                      {picked.indexOf(i) + 1}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
        <div className="bf-dig-side">
          {step === "oldest" && (
            <>
              <p className="bf-q">{t(ui.digIntro)}</p>
              <p className="bf-q strong">{t(easy ? ui.digOldestEasy : ui.digOldest)}</p>
            </>
          )}
          {step === "order" && <p className="bf-q strong">{t(ui.digOrder)}</p>}
          {msg === "oldWrong" && <div className="bf-kind">{t(ui.digOldestWrong)}</div>}
          {msg === "oldRight" && <div className="bf-good small">✅ {t(ui.digOldestRight)}</div>}
          {msg === "orderWrong" && <div className="bf-kind">{t(ui.digOrderWrong)}</div>}
          {step === "done" && (
            <div className="bf-good">
              <b>🏅 {msg === "orderRight" ? t(ui.digOrderRight) : t(ui.digDone)}</b>
              <ol className="bf-ages">
                {fossils.map((f) => (
                  <li key={f.id}>
                    <FossilIcon id={f.id} icon={f.icon} /> <b>{t(f.name)}</b> — {t(f.age)}
                  </li>
                ))}
              </ol>
              <p>{t(easy ? props.layersFactEasy : props.layersFact)}</p>
            </div>
          )}
          <div className="ow-row">
            {step !== "done" && (missA >= 2 || missB >= 2) && !hint && (
              <button className="ow-btn ow-btn-small" onClick={() => setHint(true)}>
                💡 {t(ui.showMe)}
              </button>
            )}
            {step === "done" && (
              <button className="ow-btn ow-btn-go" onClick={onDone} autoFocus>
                {t(ui.next)} ➜
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. the field station board (dig, Field Guide)
function Station({ props, exp, t, onClose }: { props: BiomeFrontierProps; exp: ExpeditionProps | undefined; t: T; onClose: () => void }) {
  const ui = props.ui;
  const round = useSurvey((s) => s.round);
  const newDig = useSurvey((s) => s.newDig);
  const save = useExp((s) => s.save);
  const hasGuide = save.tools.indexOf("guide") >= 0;
  const dug = round.digAnswers >= 2;
  const total = ((exp && exp.species) || []).length * 4;
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
            <span className="bf-slot-name">{t(exp.ui.guideChip, { n: guideScore(save), total })}</span>
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
export function Activity({ props, expedition, t, paused, onBusy }: { props: BiomeFrontierProps; expedition?: ExpeditionProps; t: T; paused?: boolean; onBusy?: (busy: boolean) => void }) {
  const mexty = useMexty();
  const view = useSurvey((s) => s.view);
  const open = useSurvey((s) => s.open);
  const close = useSurvey((s) => s.close);
  const round = useSurvey((s) => s.round);
  const easyChosen = useSurvey((s) => s.easyChosen);
  const setEasy = useSurvey((s) => s.setEasy);
  const save = useExp((s) => s.save);
  const hasGuide = save.tools.indexOf("guide") >= 0;
  const total = ((expedition && expedition.species) || []).length * 4;

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
        {expedition && <span>📖 {t(expedition.ui.guideChip, { n: guideScore(save), total })}</span>}
        <span className={round.digAnswers >= 2 ? "ok" : ""}>⛏️ {round.digAnswers >= 2 ? "✓" : "…"}</span>
      </button>
      {view && !paused && (
        <div className="ow-modal bf-modal" onPointerDown={(e) => e.target === e.currentTarget && view.kind === "sign" && close()}>
          {view.kind === "dig" && <Dig key={round.id} props={props} t={t} onDone={close} onClose={close} />}
          {view.kind === "station" && <Station props={props} exp={expedition} t={t} onClose={close} />}
          {view.kind === "sign" && <Sign props={props} t={t} biome={view.biome} onClose={close} />}
        </div>
      )}
    </>
  );
}
