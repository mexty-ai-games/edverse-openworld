// Skyharbor's learning overlays: Robot Courier (coding: sequences, then loops; arrows for ages 4–6),
// Planet Parade (order the planets from the Sun) and the fact cards. Kind feedback, no timers, no lives.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMexty } from "@mexty/sdk";
import type { T } from "../../block";
import { sound as hubSound } from "../../audio";
import { skySound } from "./audio";
import type { CourierLevel, Planet, SkyharborOpen, SkyharborProps, SkyharborUi } from "./types";
import { KIND_INFO, KIND_PLANETS, KIND_ROBOT } from "./types";
import { Block, Grid, Op, Repeat, RunResult, countBlocks, parseLevel, run, solve } from "./courier";
import "./skyharbor.css";

function tryMexty(fn: () => void) {
  try {
    fn();
  } catch {
    /* outside EdVerse */
  }
}

export function Activity({ props, open, t, onClose, paused }: {
  props: SkyharborProps;
  open: SkyharborOpen;
  t: T;
  onClose: () => void;
  paused: boolean;
}) {
  useEffect(() => {
    skySound.configure(props.sounds);
    skySound.unlock();
  }, [props.sounds]);
  if (open.kind === KIND_ROBOT) return <CourierGame props={props} t={t} onClose={onClose} paused={paused} />;
  if (open.kind === KIND_PLANETS) return <PlanetParade props={props} t={t} onClose={onClose} paused={paused} />;
  if (open.kind === KIND_INFO) {
    const s = (props.spots || []).find((x) => x.id === open.ref);
    return (
      <div className="ow-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="ow-card ow-info sh-info" role="dialog" aria-modal="true">
          {s && (
            <>
              <div className="ow-card-icon">{s.icon}</div>
              <h2 className="ow-card-title">{t(s.title)}</h2>
              <p className="ow-card-text">{t(s.text)}</p>
            </>
          )}
          <button className="ow-btn ow-btn-go" onClick={onClose} autoFocus>
            {t(props.ui.close)}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// =================================================================== icons (drawn, the same on every device)
const OP_ICON_ROT: Record<string, number> = { U: 0, E: 90, D: 180, W: 270, F: 0 };

export function OpIcon({ op, size = 30 }: { op: string; size?: number }) {
  if (op === "L" || op === "R") {
    const flip = op === "R" ? -1 : 1;
    return (
      <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden>
        <g transform={`scale(${flip},1)`}>
          <path d="M 6 9 L 6 0 Q 6 -5 1 -5 L -4 -5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M -3 -10 L -9 -5 L -3 0 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  if (op === "REP") {
    return (
      <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden>
        <path d="M -7 2 A 7 7 0 0 1 5 -5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M 2 -9 L 8 -5 L 2 -1 Z" fill="currentColor" />
        <path d="M 7 -2 A 7 7 0 0 1 -5 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M -2 9 L -8 5 L -2 1 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden>
      <g transform={`rotate(${OP_ICON_ROT[op] || 0})`}>
        <path d="M 0 9 L 0 -3" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M -7 -1 L 0 -10 L 7 -1 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function opLabel(ui: SkyharborUi, op: string, t: T): string {
  const m: Record<string, keyof SkyharborUi> = { F: "blockForward", L: "blockLeft", R: "blockRight", REP: "blockRepeat", U: "arrowUp", D: "arrowDown", W: "arrowLeft", E: "arrowRight" };
  return t(ui[m[op]]);
}

/** Gear, crate, airship and robot drawn in grid units (one cell = 10). */
function GearIcon({ x, y, r, spin }: { x: number; y: number; r: number; spin?: boolean }) {
  const teeth = 8;
  const pts: string[] = [];
  for (let k = 0; k < teeth * 2; k++) {
    const a = (k / (teeth * 2)) * Math.PI * 2;
    const rr = k % 2 ? r * 0.78 : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <g className={spin ? "sh-spin" : ""}>
        <polygon points={pts.join(" ")} fill="#f2b84b" stroke="#8a5a14" strokeWidth={0.5} />
        <circle r={r * 0.32} fill="#8a5a14" />
      </g>
    </g>
  );
}

function Airship({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M -4.2 0.6 Q 0 4.6 4.2 0.6 Z" fill="#a8683a" stroke="#5e3416" strokeWidth={0.4} />
      <line x1={0} y1={0.6} x2={0} y2={-4} stroke="#5e3416" strokeWidth={0.5} />
      <path d="M 0.3 -3.8 Q 3.4 -2 0.3 0 Z" fill="#f4ead2" stroke="#9a8a6a" strokeWidth={0.3} />
      <path d="M -0.3 -3.4 Q -2.6 -1.8 -0.3 -0.2 Z" fill="#f4ead2" stroke="#9a8a6a" strokeWidth={0.3} />
      <circle cx={-2.6} cy={2.6} r={0.6} fill="#ffd27a" />
      <circle cx={2.6} cy={2.6} r={0.6} fill="#ffd27a" />
    </g>
  );
}

function Crate({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-4} y={-4} width={8} height={8} rx={0.8} fill="#9a6235" stroke="#4e2a12" strokeWidth={0.6} />
      <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#4e2a12" strokeWidth={0.6} />
      <rect x={-4} y={-4} width={8} height={8} rx={0.8} fill="none" stroke="#e1b56a" strokeWidth={0.35} />
    </g>
  );
}

function RobotIcon({ x, y, dir, carrying, mood }: { x: number; y: number; dir: number; carrying: boolean; mood: "" | "bump" | "happy" }) {
  return (
    <g className="sh-robot" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g style={{ transform: `rotate(${dir * 90}deg)` }} className="sh-robot-rot">
        <path d="M 0 -6.2 L 2 -4.2 L -2 -4.2 Z" fill="#2ad1c0" />
      </g>
      <rect x={-3.6} y={-3.4} width={7.2} height={6.4} rx={2} fill="#f3ead8" stroke="#6b5a44" strokeWidth={0.45} />
      <rect x={-2.7} y={-2.5} width={5.4} height={3.6} rx={1} fill="#123038" />
      {mood === "bump" ? (
        <>
          <path d="M -1.8 -1.4 L -0.8 -0.6 M -0.8 -1.4 L -1.8 -0.6 M 0.8 -1.4 L 1.8 -0.6 M 1.8 -1.4 L 0.8 -0.6" stroke="#6ef5e6" strokeWidth={0.45} />
        </>
      ) : (
        <>
          <circle cx={-1.2} cy={-1.0} r={0.65} fill="#6ef5e6" />
          <circle cx={1.2} cy={-1.0} r={0.65} fill="#6ef5e6" />
        </>
      )}
      <path d={mood === "happy" ? "M -1 0.1 Q 0 1.1 1 0.1" : "M -0.9 0.3 Q 0 0.8 0.9 0.3"} stroke="#6ef5e6" strokeWidth={0.4} fill="none" />
      <line x1={0} y1={-3.4} x2={0.8} y2={-4.8} stroke="#4b4b4b" strokeWidth={0.35} />
      <circle cx={0.9} cy={-5} r={0.55} fill="#ffcf6a" />
      {carrying && <GearIcon x={2.9} y={2.6} r={1.8} />}
    </g>
  );
}

// =================================================================== Robot Courier
type Phase = "mode" | "play" | "done";
type Outcome = RunResult["outcome"] | "toolong" | "";

function pickRound(levels: CourierLevel[], simple: boolean, count: number): CourierLevel[] {
  const pool = levels.filter((l) => (l.mode === "simple") === simple);
  const stages = ["sequence", "turns", "loops"];
  const by = stages.map((s) => pool.filter((l) => l.stage === s));
  const other = pool.filter((l) => stages.indexOf(l.stage) < 0);
  const total = Math.min(count, pool.length);
  // share the round between stages (in proportion to what each stage has), keeping the order easy → hard
  const quota = by.map((b) => Math.round((b.length / Math.max(1, pool.length - other.length)) * total));
  let diff = total - quota.reduce((a, b) => a + b, 0);
  for (let i = quota.length - 1; diff !== 0 && i >= 0; i--) {
    const step = diff > 0 ? Math.min(diff, by[i].length - quota[i]) : Math.max(diff, -quota[i]);
    quota[i] += step;
    diff -= step;
  }
  const out: CourierLevel[] = [];
  by.forEach((b, i) => {
    const chosen = b
      .map((l, k) => ({ l, k, r: Math.random() }))
      .sort((a, c) => a.r - c.r)
      .slice(0, quota[i])
      .sort((a, c) => a.k - c.k)
      .map((x) => x.l);
    out.push(...chosen);
  });
  return out.concat(other).slice(0, total);
}

interface Drag {
  op: Op | "REP";
  x0: number;
  y0: number;
  x: number;
  y: number;
  moved: boolean;
}

function CourierGame({ props, t, onClose, paused }: { props: SkyharborProps; t: T; onClose: () => void; paused: boolean }) {
  const ui = props.ui;
  const mexty = useMexty();
  const [phase, setPhase] = useState<Phase>("mode");
  const [simple, setSimple] = useState(false);
  const [suggestSimple, setSuggestSimple] = useState<boolean | null>(null);
  const [round, setRound] = useState<CourierLevel[]>([]);
  const [idx, setIdx] = useState(0);
  const [program, setProgram] = useState<Block[]>([]);
  const [history, setHistory] = useState<Block[][]>([]);
  const [openLoop, setOpenLoop] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [shown, setShown] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [frame, setFrame] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [t0, setT0] = useState(() => Date.now());
  const level = round[idx];
  const grid: Grid | null = useMemo(() => (level ? parseLevel(level) : null), [level]);
  const loops = !simple && !!level && level.stage === "loops";
  const used = countBlocks(program);
  const max = level?.maxBlocks || 0;
  const running = !!result && frame < result.frames.length - 1;
  const solved = outcome === "delivered";

  // suggest a mode from the player's age (grown-ups and guests choose freely)
  useEffect(() => {
    let alive = true;
    mexty
      .getPlayer()
      .then((p: { ageMax?: number | null }) => {
        if (alive && p && typeof p.ageMax === "number") setSuggestSimple(p.ageMax <= 6);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mexty]);

  const start = (asSimple: boolean) => {
    setSimple(asSimple);
    const r = pickRound(props.levels || [], asSimple, asSimple ? props.roundSimple || 6 : props.roundMain || 8);
    setRound(r);
    setIdx(0);
    setResults([]);
    setT0(Date.now());
    resetLevel();
    setPhase(r.length ? "play" : "mode");
    hubSound.sfx("pop", 0.6);
  };

  function resetLevel() {
    setProgram([]);
    setHistory([]);
    setOpenLoop(null);
    setAttempts(0);
    setShown(false);
    setResult(null);
    setFrame(0);
    setOutcome("");
  }

  // ---------------------------------------------------------------- editing
  const edit = useCallback(
    (next: Block[], loop: number | null) => {
      setHistory((h) => h.concat([program]).slice(-40));
      setProgram(next);
      setOpenLoop(loop);
      setResult(null);
      setFrame(0);
      if (outcome !== "delivered") setOutcome("");
    },
    [program, outcome],
  );

  const add = (op: Op | "REP", into?: number | null) => {
    if (running || solved || paused) return;
    if (countBlocks(program) >= 40) return;
    const target = into != null ? into : openLoop;
    if (op === "REP") {
      const next = program.concat([{ op: "REP", n: 2, body: [] } as Repeat]);
      edit(next, next.length - 1);
    } else if (target != null && program[target] && program[target].op === "REP") {
      const next = program.map((b, i) => (i === target ? { ...(b as Repeat), body: (b as Repeat).body.concat([{ op }]) } : b));
      edit(next, target);
    } else edit(program.concat([{ op }]), null);
    skySound.play("whirr", 0.35, 1.4);
  };

  const removeTop = (i: number) => {
    if (running || solved) return;
    const next = program.filter((_, k) => k !== i);
    edit(next, openLoop == null ? null : openLoop === i ? null : openLoop > i ? openLoop - 1 : openLoop);
    hubSound.sfx("pop", 0.4);
  };
  const removeInner = (i: number, j: number) => {
    if (running || solved) return;
    edit(
      program.map((b, k) => (k === i ? { ...(b as Repeat), body: (b as Repeat).body.filter((_, x) => x !== j) } : b)),
      openLoop,
    );
    hubSound.sfx("pop", 0.4);
  };
  const setTimes = (i: number, d: number) => {
    if (running || solved) return;
    edit(
      program.map((b, k) => (k === i ? { ...(b as Repeat), n: Math.max(2, Math.min(9, (b as Repeat).n + d)) } : b)),
      openLoop,
    );
  };
  const undo = () => {
    if (running || solved || !history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setProgram(prev);
    setOpenLoop(null);
    setResult(null);
    setFrame(0);
    setOutcome("");
  };

  // drag a block from the palette onto the program (or into a loop); a tap adds it too
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10;
      setDrag({ ...d, x: e.clientX, y: e.clientY, moved });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      if (!d.moved) {
        add(d.op);
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zone = el?.closest("[data-drop]") as HTMLElement | null;
      if (!zone) return;
      const v = zone.getAttribute("data-drop") || "";
      if (v.startsWith("loop:") && d.op !== "REP") add(d.op, Number(v.slice(5)));
      else add(d.op, v === "program" ? -1 : null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  // ---------------------------------------------------------------- running
  const go = () => {
    if (!grid || running || solved || paused) return;
    if (!program.length) {
      setOutcome("empty");
      hubSound.sfx("pop", 0.5);
      return;
    }
    if (max && used > max) {
      setOutcome("toolong");
      skySound.play("bump", 0.5);
      return;
    }
    setOpenLoop(null);
    const r = run(grid, program);
    setResult(r);
    setFrame(0);
    setOutcome("");
  };

  useEffect(() => {
    if (!result || paused) return;
    if (frame >= result.frames.length - 1) {
      // the run is over: say what happened, kindly
      const o = result.outcome;
      setOutcome(o);
      if (o === "delivered") {
        const first = attempts === 0 && !shown;
        tryMexty(() =>
          mexty.progress.answer({ questionId: "skyharbor-courier-" + level.id, question: t(ui.questionCourier, { id: level.id }), correct: first, attempt: attempts + 1 }),
        );
        setResults((rs) => {
          const c = rs.slice();
          c[idx] = first;
          return c;
        });
        skySound.play("beep", 0.8, 1.1);
        hubSound.sfx("success", 0.8);
      } else {
        setAttempts((a) => a + 1);
        if (o === "bump" || o === "edge") skySound.play("bump", 0.7);
        else hubSound.sfx("pop", 0.5);
      }
      return;
    }
    const id = window.setTimeout(() => {
      const f = result.frames[frame + 1];
      if (f.event === "move") skySound.play("whirr", 0.35);
      else if (f.event === "turn") skySound.play("whirr", 0.25, 1.5);
      else if (f.event === "pick") skySound.play("beep", 0.6);
      setFrame((n) => n + 1);
    }, frame === 0 ? 250 : 430);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, frame, paused]);

  const next = () => {
    const n = idx + 1;
    if (n >= round.length) {
      const firsts = results.filter(Boolean).length;
      tryMexty(() => {
        mexty.progress.complete(firsts, round.length, { timeSpentMs: Date.now() - t0 });
        mexty.celebrate();
      });
      setPhase("done");
      return;
    }
    setIdx(n);
    resetLevel();
    hubSound.sfx("chime", 0.6);
  };

  const showMe = () => {
    if (!grid || running) return;
    const sol = solve(grid, simple, loops);
    edit(sol, null);
    setShown(true);
    setOutcome("");
  };

  // ---------------------------------------------------------------- view
  const cur = result ? result.frames[Math.min(frame, result.frames.length - 1)] : null;
  const step = cur && result && cur.step >= 0 ? result.steps[cur.step] : null;
  const bad = outcome === "bump" || outcome === "edge" ? result?.steps[result.badStep] || null : null;
  const isActive = (top: number, inner: number) => {
    const s = bad || (running ? step : null);
    return !!s && s.top === top && s.inner === inner;
  };
  const trail = result ? result.frames.slice(0, frame + 1) : [];
  const message = (() => {
    if (shown && !result) return { cls: "", text: t(ui.shownSolution) };
    switch (outcome) {
      case "empty":
        return { cls: "", text: t(ui.msgEmpty) };
      case "toolong":
        return { cls: "warn", text: t(ui.msgTooLong, { max, used }) };
      case "bump":
        return { cls: "warn", text: t(ui.msgBump, { step: (result?.badStep || 0) + 1 }) };
      case "edge":
        return { cls: "warn", text: t(ui.msgEdge, { step: (result?.badStep || 0) + 1 }) };
      case "nopart":
        return { cls: "warn", text: t(ui.msgNoPart) };
      case "notthere":
        return { cls: "warn", text: t(ui.msgNotThere) };
      case "delivered":
        return { cls: "good", text: t(ui.msgDelivered) + (attempts === 0 && !shown ? " " + t(ui.msgFirstTry) : "") };
      default:
        return cur && cur.event === "pick" ? { cls: "good", text: t(ui.msgPicked) } : { cls: "soft", text: level ? t(level.tip) : "" };
    }
  })();

  const palette: (Op | "REP")[] = simple ? ["U", "W", "E", "D"] : loops && openLoop == null ? ["F", "L", "R", "REP"] : ["F", "L", "R"];
  const chip = (op: string, key: string, onTap: () => void, active: boolean, inner = false) => (
    <button key={key} className={"sh-chip sh-op-" + op + (active ? " active" : "") + (inner ? " inner" : "")} onClick={onTap} aria-label={opLabel(ui, op, t)} title={opLabel(ui, op, t)}>
      <OpIcon op={op} size={simple ? 34 : 26} />
      {!simple && <span>{opLabel(ui, op, t)}</span>}
    </button>
  );

  return (
    <div className="ow-modal sh-modal">
      <div className="sh-panel ow-card" role="dialog" aria-modal="true">
        <div className="sh-head">
          <div className="sh-title">🤖 {t(ui.courierTitle)}</div>
          {phase === "play" && level && <div className="sh-level">{t(ui.level, { n: idx + 1, total: round.length })}</div>}
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={onClose}>
            ✕
          </button>
        </div>

        {phase === "mode" && (
          <div className="sh-mode">
            <p className="sh-intro">{t(ui.courierIntro)}</p>
            <h3>{t(ui.chooseMode)}</h3>
            <div className="sh-modes">
              <button className={"sh-modecard" + (suggestSimple === true ? " suggested" : "")} onClick={() => start(true)}>
                <div className="sh-modeicons">
                  <OpIcon op="U" size={34} />
                  <OpIcon op="E" size={34} />
                </div>
                <b>{t(ui.modeSimple)}</b>
                <span>{t(ui.modeSimpleHint)}</span>
              </button>
              <button className={"sh-modecard main" + (suggestSimple === false ? " suggested" : "")} onClick={() => start(false)}>
                <div className="sh-modeicons">
                  <OpIcon op="F" size={30} />
                  <OpIcon op="L" size={30} />
                  <OpIcon op="REP" size={30} />
                </div>
                <b>{t(ui.modeMain)}</b>
                <span>{t(ui.modeMainHint)}</span>
              </button>
            </div>
          </div>
        )}

        {phase === "play" && level && grid && (
          <div className={"sh-play" + (simple ? " simple" : "")}>
            <div className="sh-board">
              <div className="sh-goal">{t(simple ? ui.goalSimple : ui.goal)}</div>
              <svg className="sh-grid" viewBox={`-1 -1 ${grid.w * 10 + 2} ${grid.h * 10 + 2}`} style={{ aspectRatio: `${grid.w * 10 + 2} / ${grid.h * 10 + 2}` }}>
                <rect x={-1} y={-1} width={grid.w * 10 + 2} height={grid.h * 10 + 2} rx={2} fill="#5c3d22" />
                {grid.cells.map((row, y) =>
                  row.map((c, x) => (
                    <g key={x + "," + y}>
                      <rect x={x * 10 + 0.3} y={y * 10 + 0.3} width={9.4} height={9.4} rx={1.2} fill={(x + y) % 2 ? "#c99a64" : "#d4a872"} />
                      <path d={`M ${x * 10 + 0.6} ${y * 10 + 3.4} H ${x * 10 + 9.4} M ${x * 10 + 0.6} ${y * 10 + 6.6} H ${x * 10 + 9.4}`} stroke="#b0814d" strokeWidth={0.25} />
                      {c === "#" && <Crate x={x * 10 + 5} y={y * 10 + 5} />}
                    </g>
                  )),
                )}
                <g>
                  <rect x={grid.goal.x * 10 + 0.6} y={grid.goal.y * 10 + 0.6} width={8.8} height={8.8} rx={1.4} fill="#2b5c7a" stroke="#ffd27a" strokeWidth={0.5} strokeDasharray="1.4 1" />
                  <Airship x={grid.goal.x * 10 + 5} y={grid.goal.y * 10 + 5} />
                </g>
                {!(cur && cur.carrying) && grid.part.x >= 0 && <GearIcon x={grid.part.x * 10 + 5} y={grid.part.y * 10 + 5} r={3.2} spin />}
                {trail.slice(1).map((f, i) => (
                  <circle key={i} cx={f.x * 10 + 5} cy={f.y * 10 + 5} r={0.9} fill="#2ad1c0" stroke="#0e5a52" strokeWidth={0.3} opacity={0.9} />
                ))}
                {result && result.bumpCell && frame >= result.frames.length - 1 && (
                  <g transform={`translate(${Math.max(-0.5, Math.min(grid.w * 10 + 0.5, result.bumpCell.x * 10 + 5 - (result.bumpCell.x - (cur?.x ?? 0)) * 4.5))},${Math.max(-0.5, Math.min(grid.h * 10 + 0.5, result.bumpCell.y * 10 + 5 - (result.bumpCell.y - (cur?.y ?? 0)) * 4.5))})`}>
                    <g className="sh-bonk">
                      <polygon points="0,-3 0.9,-0.9 3,0 0.9,0.9 0,3 -0.9,0.9 -3,0 -0.9,-0.9" fill="#ffd27a" stroke="#a35a12" strokeWidth={0.35} />
                    </g>
                  </g>
                )}
                <RobotIcon
                  x={(cur ? cur.x : grid.start.x) * 10 + 5}
                  y={(cur ? cur.y : grid.start.y) * 10 + 5}
                  dir={cur ? cur.dir : grid.start.dir}
                  carrying={!!cur && cur.carrying}
                  mood={outcome === "bump" || outcome === "edge" ? "bump" : outcome === "delivered" ? "happy" : ""}
                />
              </svg>
              <div className={"ow-sky-msg sh-msg " + message.cls}>{message.text}</div>
            </div>

            <div className="sh-code">
              <div className="sh-code-head">
                <b>{t(ui.program)}</b>
                {max > 0 && (
                  <span className={"sh-mem" + (used > max ? " over" : "")}>
                    {t(ui.memory, { used, max })}
                    <i style={{ width: Math.min(100, (used / max) * 100) + "%" }} />
                  </span>
                )}
              </div>
              <div className={"sh-program" + (drag && drag.moved ? " dropping" : "")} data-drop="program">
                {!program.length && <div className="sh-empty">{t(simple ? ui.programEmptySimple : ui.programEmpty)}</div>}
                {program.map((b, i) =>
                  b.op === "REP" ? (
                    <div key={i} className={"sh-loop" + (openLoop === i ? " open" : "") + (isActive(i, -1) ? " active" : "")} data-drop={"loop:" + i}>
                      <div className="sh-loop-head">
                        <button className="sh-loop-x" onClick={() => removeTop(i)} aria-label={t(ui.undo)}>
                          <OpIcon op="REP" size={22} />
                        </button>
                        <button className="sh-times" onClick={() => setTimes(i, -1)} aria-label="−">
                          −
                        </button>
                        <b className="sh-n">{(b as Repeat).n}</b>
                        <button className="sh-times" onClick={() => setTimes(i, 1)} aria-label="+">
                          +
                        </button>
                        <span>{t(ui.times)}</span>
                        <button className="sh-loop-toggle" onClick={() => setOpenLoop(openLoop === i ? null : i)}>
                          {openLoop === i ? "✓ " + t(ui.loopDone) : "✎"}
                        </button>
                      </div>
                      <div className="sh-loop-body">
                        {(b as Repeat).body.map((s, j) => chip(s.op, i + "-" + j, () => removeInner(i, j), isActive(i, j), true))}
                        {openLoop === i && <div className="sh-slot">＋ {t(ui.loopInside)}</div>}
                      </div>
                    </div>
                  ) : (
                    chip(b.op, String(i), () => removeTop(i), isActive(i, -1))
                  ),
                )}
              </div>
              <div className="sh-palette">
                {palette.map((op) => (
                  <button
                    key={op}
                    className={"sh-pal sh-op-" + op}
                    disabled={running || solved}
                    onPointerDown={(e) => {
                      if (running || solved) return;
                      e.preventDefault();
                      setDrag({ op, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        add(op);
                      }
                    }}
                    aria-label={opLabel(ui, op, t)}
                  >
                    <OpIcon op={op} size={simple ? 40 : 30} />
                    {!simple && <span>{opLabel(ui, op, t)}</span>}
                  </button>
                ))}
              </div>
              {!simple && <div className="sh-hint">{t(ui.dragHint)}</div>}
              <div className="sh-actions">
                {!solved && (
                  <>
                    <button className="ow-btn ow-btn-small sh-ghost" onClick={undo} disabled={running || !history.length} aria-label={t(ui.undo)}>
                      ↶ {t(ui.undo)}
                    </button>
                    <button className="ow-btn ow-btn-small sh-ghost" onClick={() => edit([], null)} disabled={running || !program.length}>
                      🧹 {t(ui.clear)}
                    </button>
                    {attempts >= 3 && !shown && (
                      <button className="ow-btn ow-btn-small" onClick={showMe} disabled={running}>
                        💡 {t(ui.showMe)}
                      </button>
                    )}
                    <button className="ow-btn sh-go" onClick={go} disabled={running}>
                      ▶ {t(ui.run)}
                    </button>
                  </>
                )}
                {solved && (
                  <button className="ow-btn sh-go" onClick={next} autoFocus>
                    {t(ui.next)} ➜
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="sh-done">
            <div className="sh-done-art">🎉</div>
            <h2 className="ow-card-title">{t(ui.roundDone)}</h2>
            <div className="sh-stars">
              {round.map((_, i) => (
                <span key={i} className={results[i] ? "on" : ""}>
                  ⚙️
                </span>
              ))}
            </div>
            <p className="ow-card-text">{t(ui.roundScore, { n: results.filter(Boolean).length, total: round.length })}</p>
            <div className="ow-row">
              <button className="ow-btn ow-btn-small" onClick={() => start(simple)}>
                🔁 {t(ui.playAgain)}
              </button>
              <button className="ow-btn ow-btn-small sh-ghost" onClick={() => setPhase("mode")}>
                {t(ui.changeMode)}
              </button>
              <button className="ow-btn" onClick={onClose}>
                {t(ui.close)}
              </button>
            </div>
          </div>
        )}
      </div>
      {drag && drag.moved && (
        <div className={"sh-chip sh-ghostchip sh-op-" + drag.op} style={{ left: drag.x, top: drag.y }}>
          <OpIcon op={drag.op} size={30} />
        </div>
      )}
    </div>
  );
}

// =================================================================== Planet Parade
function PlanetArt({ p, r }: { p: Planet; r: number }) {
  const gid = "shp-" + p.id;
  return (
    <svg width={r * 2 + (p.rings ? r * 1.4 : 8)} height={r * 2 + 8} viewBox={`${-r - (p.rings ? r * 0.7 : 4)} ${-r - 4} ${r * 2 + (p.rings ? r * 1.4 : 8)} ${r * 2 + 8}`} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="18%" stopColor={p.color} />
          <stop offset="100%" stopColor={p.color2} />
        </radialGradient>
        <clipPath id={gid + "c"}>
          <circle r={r} />
        </clipPath>
      </defs>
      {p.rings && <ellipse rx={r * 1.65} ry={r * 0.45} fill="none" stroke="#d8c08a" strokeWidth={r * 0.18} opacity={0.75} transform="rotate(-18)" />}
      <circle r={r} fill={`url(#${gid})`} />
      <g clipPath={`url(#${gid}c)`}>
        {(p.id === "jupiter" || p.id === "saturn") &&
          [-0.5, -0.15, 0.25, 0.6].map((y, i) => <rect key={i} x={-r} y={y * r} width={r * 2} height={r * 0.14} fill={p.color2} opacity={0.55} />)}
        {p.id === "jupiter" && <ellipse cx={r * 0.35} cy={r * 0.38} rx={r * 0.22} ry={r * 0.13} fill="#c0533a" />}
        {p.id === "earth" && (
          <>
            <path d={`M ${-r * 0.6} ${-r * 0.3} q ${r * 0.3} ${-r * 0.4} ${r * 0.6} ${-r * 0.1} q ${r * 0.1} ${r * 0.4} ${-r * 0.2} ${r * 0.5} q ${-r * 0.4} 0 ${-r * 0.4} ${-r * 0.4} Z`} fill={p.color2} />
            <path d={`M ${r * 0.2} ${r * 0.2} q ${r * 0.4} ${-r * 0.2} ${r * 0.5} ${r * 0.2} q ${-r * 0.1} ${r * 0.4} ${-r * 0.4} ${r * 0.3} Z`} fill={p.color2} />
          </>
        )}
        {p.id === "mars" && <circle cx={-r * 0.3} cy={r * 0.2} r={r * 0.15} fill={p.color2} />}
        {p.id === "mercury" && [[-0.3, -0.2, 0.15], [0.3, 0.3, 0.12], [0.1, -0.45, 0.08]].map(([x, y, s], i) => <circle key={i} cx={x * r} cy={y * r} r={s * r} fill={p.color2} />)}
      </g>
      {p.rings && <path d={`M ${-r * 1.57} ${r * 0.22} A ${r * 1.65} ${r * 0.45} 0 0 0 ${r * 1.57} ${-r * 0.22}`} transform="rotate(-18)" fill="none" stroke="#d8c08a" strokeWidth={r * 0.18} opacity={0.9} />}
    </svg>
  );
}

function PlanetParade({ props, t, onClose, paused }: { props: SkyharborProps; t: T; onClose: () => void; paused: boolean }) {
  const ui = props.ui;
  const mexty = useMexty();
  const ordered = useMemo(() => (props.planets || []).slice().sort((a, b) => a.order - b.order), [props.planets]);
  const [seed, setSeed] = useState(1);
  const tray = useMemo(() => {
    const a = ordered.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, seed]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [msg, setMsg] = useState<{ cls: string; text: string } | null>(null);
  const [hint, setHint] = useState(false);
  const [t0, setT0] = useState(() => Date.now());
  const k = placed.length;
  const target = ordered[k];
  const done = k >= ordered.length && ordered.length > 0;

  const tap = (p: Planet) => {
    if (!target || paused || placed.indexOf(p.id) >= 0) return;
    if (p.id === target.id) {
      const first = misses === 0;
      tryMexty(() =>
        mexty.progress.answer({ questionId: "skyharbor-planet-" + target.order, question: t(ui.questionPlanet, { n: target.order }), correct: first, attempt: misses + 1 }),
      );
      const ft = firstTry + (first ? 1 : 0);
      setFirstTry(ft);
      const np = placed.concat(p.id);
      setPlaced(np);
      setMisses(0);
      setHint(false);
      setMsg({ cls: "good", text: t(ui.planetsGood, { name: t(p.name) }) + " " + t(p.fact) });
      hubSound.sfx("success", 0.7);
      if (np.length >= ordered.length)
        tryMexty(() => {
          mexty.progress.complete(ft, ordered.length, { timeSpentMs: Date.now() - t0 });
          mexty.celebrate();
        });
    } else {
      setMisses((m) => m + 1);
      setMsg({ cls: "warn", text: t(ui.planetsNotYet, { name: t(p.name) }) });
      hubSound.sfx("pop", 0.5);
    }
  };
  const again = () => {
    setPlaced([]);
    setMisses(0);
    setFirstTry(0);
    setMsg(null);
    setHint(false);
    setSeed((s) => s + 1);
    setT0(Date.now());
  };
  const R = (p: Planet) => Math.round(13 + p.size * 11);

  return (
    <div className="ow-modal sh-modal">
      <div className="sh-panel sh-planets ow-card" role="dialog" aria-modal="true">
        <div className="sh-head">
          <div className="sh-title">🪐 {t(ui.planetsTitle)}</div>
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sh-space">
          <div className="sh-sun">
            <span>{t(ui.sun)}</span>
          </div>
          <div className="sh-orbits">
            {ordered.map((p, i) => {
              const on = placed.indexOf(p.id) >= 0;
              return (
                <div key={p.id} className={"sh-slot-planet" + (on ? " on" : "") + (i === k ? " next" : "")}>
                  {on ? <PlanetArt p={p} r={Math.round(R(p) * 0.62)} /> : <b>{i + 1}</b>}
                  <small>{on ? t(p.name) : ""}</small>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sh-pgoal">{done ? <b>{t(ui.planetsDone)}</b> : <b>{t(ui.planetsFind, { n: k + 1 })}</b>}</div>
        {!done && (
          <div className="sh-tray">
            {tray.map((p) =>
              placed.indexOf(p.id) >= 0 ? null : (
                <button key={p.id} className="sh-planet" onClick={() => tap(p)} aria-label={t(p.name)}>
                  <PlanetArt p={p} r={R(p)} />
                  <span>{t(p.name)}</span>
                </button>
              ),
            )}
          </div>
        )}
        <div className="sh-pfoot">
          {msg && <div className={"ow-sky-msg sh-msg " + msg.cls}>{msg.text}</div>}
          {!msg && !done && <div className="ow-sky-msg sh-msg soft">{t(ui.planetsIntro)}</div>}
          {hint && target && <div className="ow-sky-msg sh-msg">💡 {t(target.hint)}</div>}
          <div className="ow-row">
            {!done && misses >= 1 && !hint && (
              <button className="ow-btn ow-btn-small" onClick={() => setHint(true)}>
                💡 {t(ui.planetsHint)}
              </button>
            )}
            {done && (
              <>
                <div className="sh-stars-text">{t(ui.roundScore, { n: firstTry, total: ordered.length })}</div>
                <button className="ow-btn ow-btn-small" onClick={again}>
                  🔁 {t(ui.playAgain)}
                </button>
                <button className="ow-btn" onClick={onClose}>
                  {t(ui.close)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
