import React, { useMemo, useState } from "react";
import { useMexty } from "@mexty/sdk";
import type { Constellation, T, UiText } from "../block";
import { sound } from "../audio";

/** Faint background stars, the same every time (a seeded scatter), away from the real ones. */
function backgroundStars(cons: Constellation[]) {
  let a = 1234567;
  const r = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  const real = cons.flatMap((c) => c.stars);
  const out: { x: number; y: number; s: number }[] = [];
  let guard = 0;
  while (out.length < 90 && guard++ < 1000) {
    const x = 4 + r() * 92;
    const y = 4 + r() * 92;
    if (Math.hypot(x - 50, y - 50) > 47) continue;
    if (real.some((s) => Math.hypot(s.x - x, s.y - y) < 4.5)) continue;
    out.push({ x, y, s: 0.25 + r() * 0.45 });
  }
  return out;
}

/**
 * The star telescope: find real constellations by their shape. Each one found draws its lines and
 * shows a true fact. Every find is recorded (mexty.progress), and the round ends with complete().
 */
export function Sky({ ui, t, constellations, onFound, onClose, paused }: {
  ui: UiText;
  t: T;
  constellations: Constellation[];
  onFound: (id: string) => void;
  onClose: () => void;
  paused: boolean;
}) {
  const mexty = useMexty();
  const bg = useMemo(() => backgroundStars(constellations), [constellations]);
  const [round, setRound] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [msg, setMsg] = useState<"" | "miss" | "found">("");
  const [showMe, setShowMe] = useState(false);
  const [t0] = useState(() => Date.now());
  const total = constellations.length;
  const done = round >= total;
  const target = done ? null : constellations[round];

  const tap = (c: Constellation) => {
    if (!target || msg === "found" || paused) return;
    if (c.id === target.id) {
      const first = misses === 0;
      try {
        mexty.progress.answer({ questionId: target.id, question: t(ui.skyFind, { name: t(target.name) }), correct: first, attempt: misses + 1 });
      } catch {
        /* outside EdVerse */
      }
      if (first) setFirstTry((n) => n + 1);
      setFound((f) => f.concat(target.id));
      onFound(target.id);
      setMsg("found");
      setShowMe(false);
      sound.sfx("success", 0.8);
    } else {
      setMisses((m) => m + 1);
      setMsg("miss");
      sound.sfx("pop", 0.5);
    }
  };

  const next = () => {
    const n = round + 1;
    setRound(n);
    setMisses(0);
    setMsg("");
    setShowMe(false);
    if (n >= total) {
      try {
        mexty.progress.complete(firstTry, total, { timeSpentMs: Date.now() - t0 });
        mexty.celebrate();
      } catch {
        /* outside EdVerse */
      }
    }
  };

  const again = () => {
    setRound(0);
    setFound([]);
    setMisses(0);
    setFirstTry(0);
    setMsg("");
    setShowMe(false);
  };

  return (
    <div className="ow-modal ow-sky-modal">
      <div className="ow-sky">
        <div className="ow-sky-head">
          <div className="ow-sky-title">🔭 {t(ui.skyTitle)}</div>
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="ow-sky-goal">
          {target ? (
            <>
              <b>{t(ui.skyFind, { name: t(target.name) })}</b>
              <span>{t(target.hint)}</span>
            </>
          ) : (
            <b>{t(ui.skyDone)}</b>
          )}
        </div>
        <div className="ow-lens">
          <svg viewBox="0 0 100 100" className="ow-sky-svg">
            <defs>
              <radialGradient id="owNight" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#24365f" />
                <stop offset="70%" stopColor="#111a36" />
                <stop offset="100%" stopColor="#0a0f22" />
              </radialGradient>
              <filter id="owGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.8" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="50" cy="50" r="49" fill="url(#owNight)" />
            {bg.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#dfe6ff" opacity={0.55} />
            ))}
            {constellations.map((c) => {
              const isFound = found.indexOf(c.id) >= 0;
              const hinted = showMe && target && c.id === target.id;
              return (
                <g key={c.id}>
                  {isFound &&
                    c.lines.map(([a, b], i) =>
                      c.stars[a] && c.stars[b] ? (
                        <line key={i} className="ow-cline" x1={c.stars[a].x} y1={c.stars[a].y} x2={c.stars[b].x} y2={c.stars[b].y} />
                      ) : null,
                    )}
                  {c.stars.map((s, i) => (
                    <g key={i} onPointerDown={() => tap(c)} style={{ cursor: "pointer" }}>
                      <circle cx={s.x} cy={s.y} r={4.2} fill="transparent" />
                      <circle cx={s.x} cy={s.y} r={0.55 + s.size * 0.45} fill={isFound ? "#ffe9a8" : "#ffffff"} filter="url(#owGlow)" className={hinted ? "ow-star-hint" : ""} />
                    </g>
                  ))}
                  {isFound && (
                    <text x={c.stars.reduce((a, s) => a + s.x, 0) / c.stars.length} y={Math.max(...c.stars.map((s) => s.y)) + 5} className="ow-cname">
                      {t(c.name)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="ow-sky-foot">
          {msg === "found" && target && (
            <div className="ow-sky-msg good">
              <b>🌟 {t(ui.skyFound)}</b> {t(target.fact)}
            </div>
          )}
          {msg === "miss" && <div className="ow-sky-msg">{t(ui.skyTryAgain)}</div>}
          {!msg && target && <div className="ow-sky-msg soft">{t(ui.skyTapHint)}</div>}
          <div className="ow-row">
            {target && msg !== "found" && misses >= 2 && !showMe && (
              <button className="ow-btn ow-btn-small" onClick={() => setShowMe(true)}>
                💡 {t(ui.skyShowMe)}
              </button>
            )}
            {target && msg === "found" && (
              <button className="ow-btn ow-btn-go" onClick={next}>
                {t(ui.skyNext)} ➜
              </button>
            )}
            {done && (
              <>
                <button className="ow-btn ow-btn-small" onClick={again}>
                  🔁 {t(ui.skyAgain)}
                </button>
                <button className="ow-btn ow-btn-go" onClick={onClose}>
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
