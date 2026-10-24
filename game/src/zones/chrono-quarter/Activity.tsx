// Time Detective (History, ages 4-18; main mode 7-12, "little detective" icon mode for 4-6).
// Lost artifacts lie around the Chrono Quarter. The detective picks one up, reads its clue, carries it
// to the display stand of the era it comes from (Ancient Rome, Classic Maya, Edo Japan) and learns a
// true fact. When every artifact is home, the Time Dial asks for the eras in order, oldest first.
// Every delivery and the timeline are recorded with mexty.progress.answer; the round ends with
// mexty.progress.complete(first-try answers, artifacts + 1). Kind feedback, hints, no timer, no lives.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { pickLanguage, useLanguage, useMexty } from "@mexty/sdk";
import type { LocalizedText, T } from "../../block";
import type { Game, Target } from "../../game/state";
import { sound } from "../../audio";
import type { ChronoQuarterProps, CqArtifact, CqEra } from "./types";
import { getCase, newRound, setCase, useCase } from "./store";
import { KIND_ARTIFACT, KIND_DIAL, KIND_STAND } from "./Scene";
import "./chrono.css";

type Modal =
  | { kind: "intro" }
  | { kind: "artifact"; id: string }
  | { kind: "result"; id: string; era: string; ok: boolean }
  | { kind: "stand"; era: string }
  | { kind: "dial" }
  | { kind: "file" }
  | { kind: "done" };

function shuffle<X>(a: X[]): X[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function Activity({ props, game, t: tProp, paused, young: youngProp, onBlockingChange }: {
  props: ChronoQuarterProps;
  game: Game;
  /** The hub's translator; built from the SDK language when left out. */
  t?: T;
  paused?: boolean;
  /** Force the little-detective mode (otherwise: the player's age tile 4-6, or their choice). */
  young?: boolean;
  /** True while a card is open (the hub blocks walking keys and dims its HUD). */
  onBlockingChange?: (blocking: boolean) => void;
}) {
  const mexty = useMexty();
  const lang = useLanguage();
  const tOwn: T = useCallback(
    (x, vars) => {
      let s = x == null ? "" : typeof x === "string" ? x : pickLanguage(x, lang.language, lang.defaultLanguage || "en");
      if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    },
    [lang.language, lang.defaultLanguage],
  );
  const t = tProp || tOwn;
  const ui = props.ui;
  const c = useCase();
  const [modal, setModal] = useState<Modal | null>(c.phase === "intro" ? { kind: "intro" } : null);
  const [toast, setToast] = useState<string>("");
  const [young, setYoung] = useState<boolean>(youngProp ?? c.young);
  const byId = useMemo(() => {
    const m: Record<string, CqArtifact> = {};
    for (const a of props.artifacts) m[a.id] = a;
    return m;
  }, [props.artifacts]);
  const eraOf = useMemo(() => {
    const m: Record<string, CqEra> = {};
    for (const e of props.eras) m[e.id] = e;
    return m;
  }, [props.eras]);

  // little detectives (age tile 4-6) start in icon mode; they (or a grown-up) can switch
  useEffect(() => {
    if (youngProp != null) return;
    let alive = true;
    mexty
      .getPlayer()
      .then((p: { ageMin?: number | null; ageMax?: number | null }) => {
        if (alive && p && p.ageMax != null && p.ageMax <= 6 && getCase().phase === "intro") setYoung(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mexty, youngProp]);

  useEffect(() => {
    if (onBlockingChange) onBlockingChange(!!modal);
  }, [modal, onBlockingChange]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 5200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const total = c.items.length;
  const size = young ? props.roundSizeYoung : props.roundSize;

  const start = () => {
    newRound(props.artifacts, props.eras.map((e) => e.id), Math.max(1, size), young);
    sound.unlock();
    sound.sfx("chime", 0.7);
    setModal(null);
    setToast(t(young ? ui.introYoung : ui.carryHint, { n: Math.max(1, size) }));
  };

  // ---------------------------------------------------------------- opening things in the world
  const openTarget = useCallback(
    (f: Target) => {
      if (paused) return;
      const kind = String(f.kind);
      const cs = getCase();
      if (cs.phase === "intro") {
        setModal({ kind: "intro" });
        return;
      }
      if (kind === KIND_ARTIFACT) {
        if (cs.phase !== "hunt" || cs.delivered.indexOf(String(f.ref)) >= 0) return;
        setModal({ kind: "artifact", id: String(f.ref) });
        sound.sfx("chime", 0.6);
      } else if (kind === KIND_STAND) {
        const era = String(f.ref);
        if (cs.carrying && cs.phase === "hunt") deliver(cs.carrying, era);
        else {
          setModal({ kind: "stand", era });
          sound.sfx("pop", 0.6);
        }
      } else if (kind === KIND_DIAL) {
        setModal(cs.phase === "done" ? { kind: "done" } : { kind: "dial" });
        sound.sfx("pop", 0.6);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paused, young, props],
  );
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<Target>).detail;
      if (f && String(f.kind).indexOf("chrono-quarter:") === 0) openTarget(f);
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [openTarget]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Escape" && modal && modal.kind !== "intro") setModal(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [modal]);

  const pickUp = (id: string) => {
    const cs = getCase();
    if (cs.carrying && cs.carrying !== id) setToast(t(ui.putBack, { name: t(byId[cs.carrying]?.name) }));
    else setToast(t(ui.carryHint));
    setCase({ carrying: id, hintEra: (cs.misses[id] || 0) >= hintAfter() ? byId[id].era : null });
    game.emote("cheer");
    sound.sfx("pop", 0.8);
    setModal(null);
  };
  const hintAfter = () => (getCase().young ? 1 : Math.max(1, props.hintAfter));

  const deliver = (id: string, era: string) => {
    const a = byId[id];
    if (!a) return;
    const cs = getCase();
    const misses = cs.misses[id] || 0;
    const ok = a.era === era;
    try {
      mexty.progress.answer({ questionId: "chrono-" + id, question: t(ui.question, { name: t(a.name) }), correct: ok && misses === 0, attempt: misses + 1 });
    } catch {
      /* outside EdVerse */
    }
    if (ok) {
      setCase({
        carrying: null,
        hintEra: null,
        delivered: cs.delivered.concat(id),
        firstTry: cs.firstTry + (misses === 0 ? 1 : 0),
      });
      game.emote("cheer");
      sound.sfx("success", 0.8);
    } else {
      const m = misses + 1;
      setCase({ misses: { ...cs.misses, [id]: m }, hintEra: m >= hintAfter() ? a.era : null });
      sound.sfx("pop", 0.5);
    }
    setModal({ kind: "result", id, era, ok });
  };

  const afterResult = (ok: boolean) => {
    const cs = getCase();
    setModal(null);
    if (ok && cs.items.length && cs.delivered.length >= cs.items.length && cs.phase === "hunt") {
      setCase({ phase: "timeline" });
      setToast(t(ui.allReturned));
      sound.sfx("chime", 0.8);
    }
  };

  // ---------------------------------------------------------------- the timeline on the Time Dial
  const ordered = useMemo(() => props.eras.slice().sort((a, b) => a.sortYear - b.sortYear), [props.eras]);
  const [deck, setDeck] = useState<CqEra[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [dialMiss, setDialMiss] = useState(0);
  const [dialMsg, setDialMsg] = useState<"" | "wrong" | "right">("");
  useEffect(() => {
    if (modal && modal.kind === "dial") {
      setDeck(shuffle(props.eras));
      setPicks([]);
      setDialMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal && modal.kind]);

  const finishTimeline = (firstTry: boolean, attempts: number) => {
    const cs = getCase();
    try {
      mexty.progress.answer({ questionId: "chrono-timeline", question: t(cs.young ? ui.dialAskYoung : ui.dialAsk), correct: firstTry, attempt: attempts });
    } catch {
      /* outside EdVerse */
    }
    const score = cs.firstTry + (firstTry ? 1 : 0);
    const max = cs.items.length + 1;
    try {
      mexty.progress.complete(score, max, { timeSpentMs: Date.now() - cs.startedAt });
      mexty.celebrate();
    } catch {
      /* outside EdVerse */
    }
    setCase({ phase: "done", timelineFirstTry: firstTry });
    setDialMsg("right");
    sound.sfx("success", 0.9);
  };

  const tapEra = (e: CqEra) => {
    const cs = getCase();
    if (cs.phase !== "timeline" || dialMsg === "right") return;
    if (cs.young) {
      if (e.id === ordered[0].id) finishTimeline(dialMiss === 0, dialMiss + 1);
      else {
        setDialMiss((m) => m + 1);
        setDialMsg("wrong");
        sound.sfx("pop", 0.5);
      }
      return;
    }
    if (picks.indexOf(e.id) >= 0) return;
    const want = ordered[picks.length];
    if (e.id === want.id) {
      const next = picks.concat(e.id);
      setPicks(next);
      setDialMsg("");
      sound.sfx("pop", 0.7);
      if (next.length === ordered.length) finishTimeline(dialMiss === 0, dialMiss + 1);
    } else {
      setDialMiss((m) => m + 1);
      setDialMsg("wrong");
      sound.sfx("pop", 0.5);
    }
  };

  const again = () => {
    setDialMiss(0);
    newRound(props.artifacts, props.eras.map((x) => x.id), Math.max(1, young ? props.roundSizeYoung : props.roundSize), young);
    setModal(null);
    setToast(t(young ? ui.introYoung : ui.carryHint, { n: young ? props.roundSizeYoung : props.roundSize }));
  };

  // ---------------------------------------------------------------- rendering
  const L = (x: LocalizedText | undefined) => t(x);
  const carrying = c.carrying ? byId[c.carrying] : null;
  const factOf = (a: CqArtifact) => (c.young ? L(a.factSimple) : L(a.fact));

  let body: React.ReactNode = null;
  if (modal) {
    if (modal.kind === "intro") {
      body = (
        <>
          <div className="cq-kicker">🔍 {L(ui.title)}</div>
          <div className="cq-era-strip">
            {props.eras.map((e) => (
              <span key={e.id} className="cq-era-dot" style={{ background: e.color }}>
                {e.icon}
              </span>
            ))}
          </div>
          <p className="ow-card-text">{t(young ? ui.introYoung : ui.intro, { n: size })}</p>
          <div className="ow-seg cq-mode">
            <button className={!young ? "on" : ""} onClick={() => setYoung(false)}>
              🧒 {L(ui.big)}
            </button>
            <button className={young ? "on" : ""} onClick={() => setYoung(true)}>
              🐣 {L(ui.young)}
            </button>
          </div>
          <button className="ow-btn ow-btn-go" onClick={start} autoFocus>
            ✨ {L(ui.start)}
          </button>
        </>
      );
    } else if (modal.kind === "artifact") {
      const a = byId[modal.id];
      if (a)
        body = (
          <>
            <div className="cq-kicker">✨ {L(ui.lostHere)}</div>
            <div className="cq-big-icon">{a.icon}</div>
            <h2 className="ow-card-title">{L(a.name)}</h2>
            {!c.young && (
              <p className="ow-card-text cq-clue">
                🔎 {L(a.clue)}
              </p>
            )}
            <p className="ow-card-small">{L(ui.carryHint)}</p>
            <div className="cq-era-strip">
              {props.eras.map((e) => (
                <span key={e.id} className="cq-era-chip" style={{ borderColor: e.color }}>
                  {e.icon} {L(e.name)}
                </span>
              ))}
            </div>
            <button className="ow-btn ow-btn-go" onClick={() => pickUp(a.id)} autoFocus>
              🤲 {L(ui.pickUp)}
            </button>
          </>
        );
    } else if (modal.kind === "result") {
      const a = byId[modal.id];
      const e = eraOf[modal.ok ? modal.era : a ? a.era : modal.era];
      if (a && e)
        body = modal.ok ? (
          <>
            <div className="cq-era-head" style={{ background: e.color }}>
              {e.icon} {L(e.name)} · {L(e.period)}
            </div>
            <div className="cq-big-icon">{a.icon}</div>
            <div className="cq-kicker">🌟 {t(ui.correct, { era: L(e.name) })}</div>
            <h2 className="ow-card-title">{L(a.name)}</h2>
            <p className="ow-card-text">{factOf(a)}</p>
            <button className="ow-btn ow-btn-go" onClick={() => afterResult(true)} autoFocus>
              {L(ui.next)} ➜
            </button>
          </>
        ) : (
          <>
            <div className="cq-big-icon cq-wobble">{a.icon}</div>
            <p className="ow-card-text">{L(ui.wrong)}</p>
            {!c.young && <p className="ow-card-text cq-clue">🔎 {L(a.clue)}</p>}
            {c.hintEra === a.era && (
              <p className="ow-card-text cq-hint" style={{ borderColor: e.color }}>
                💡 {t(ui.hint, { icon: e.icon, era: L(e.name) })}
              </p>
            )}
            <button className="ow-btn ow-btn-go" onClick={() => afterResult(false)} autoFocus>
              {L(ui.next)} ➜
            </button>
          </>
        );
    } else if (modal.kind === "stand") {
      const e = eraOf[modal.era];
      const here = c.delivered.filter((id) => byId[id] && byId[id].era === modal.era);
      if (e)
        body = (
          <>
            <div className="cq-era-head" style={{ background: e.color }}>
              {e.icon} {L(ui.standOf)} · {L(e.name)}
            </div>
            <div className="cq-kicker">{L(e.period)}</div>
            <p className="ow-card-text">{L(e.intro)}</p>
            {here.length ? (
              <p className="ow-card-small">
                {L(ui.standHas)} {here.map((id) => byId[id].icon + " " + L(byId[id].name)).join(" · ")}
              </p>
            ) : (
              <p className="ow-card-small">{L(ui.standEmpty)}</p>
            )}
            <button className="ow-btn ow-btn-go" onClick={() => setModal(null)} autoFocus>
              {L(ui.close)}
            </button>
          </>
        );
    } else if (modal.kind === "dial") {
      if (c.phase === "hunt")
        body = (
          <>
            <div className="cq-big-icon">⏳</div>
            <h2 className="ow-card-title">{L(ui.dialTitle)}</h2>
            <p className="ow-card-text">{t(ui.dialNotYet, { n: c.delivered.length, total })}</p>
            <button className="ow-btn ow-btn-go" onClick={() => setModal(null)} autoFocus>
              {L(ui.close)}
            </button>
          </>
        );
      else {
        const done = dialMsg === "right" || c.phase === "done";
        body = (
          <>
            <div className="cq-kicker">⏳ {L(ui.dialTitle)}</div>
            <p className="ow-card-text">
              <b>{L(c.young ? ui.dialAskYoung : ui.dialAsk)}</b>
            </p>
            {!c.young && (
              <div className="cq-timeline">
                <span className="cq-tl-end">{L(ui.oldest)}</span>
                {ordered.map((_, i) => {
                  const id = done ? ordered[i].id : picks[i];
                  const e = id ? eraOf[id] : null;
                  return (
                    <div key={i} className={"cq-slot" + (e ? " full" : "")} style={e ? { background: e.color } : undefined}>
                      {e ? (
                        <>
                          <span className="cq-slot-icon">{e.icon}</span>
                          <span>{L(e.period)}</span>
                        </>
                      ) : (
                        <span className="cq-slot-q">?</span>
                      )}
                    </div>
                  );
                })}
                <span className="cq-tl-end">{L(ui.newest)}</span>
              </div>
            )}
            {!done && (
              <div className="cq-era-buttons">
                {deck.map((e) => (
                  <button
                    key={e.id}
                    className={"cq-era-btn" + (picks.indexOf(e.id) >= 0 ? " used" : "")}
                    style={{ borderColor: e.color }}
                    onClick={() => tapEra(e)}
                    disabled={picks.indexOf(e.id) >= 0}
                  >
                    <span className="cq-era-btn-icon" style={{ background: e.color }}>
                      {e.icon}
                    </span>
                    <span className="cq-era-btn-name">{L(e.name)}</span>
                    <span className="cq-era-btn-period">{L(e.period)}</span>
                  </button>
                ))}
              </div>
            )}
            {dialMsg === "wrong" && <p className="ow-card-text cq-hint">🤔 {L(ui.dialWrong)}</p>}
            {done && (
              <>
                <div className="cq-kicker">🌟 {L(ui.dialRight)}</div>
                <p className="ow-card-text">{L(c.young ? props.timelineFactSimple : props.timelineFact)}</p>
                <button className="ow-btn ow-btn-go" onClick={() => setModal({ kind: "done" })} autoFocus>
                  {L(ui.next)} ➜
                </button>
              </>
            )}
          </>
        );
      }
    } else if (modal.kind === "done") {
      const max = c.items.length + 1;
      const score = c.firstTry + (c.timelineFirstTry ? 1 : 0);
      body = (
        <>
          <div className="cq-big-icon">🏅</div>
          <h2 className="ow-card-title">{L(ui.done)}</h2>
          <div className="cq-stars">
            {c.items.map((id) => (
              <span key={id} title={L(byId[id]?.name)}>
                {byId[id]?.icon}
              </span>
            ))}
          </div>
          <p className="ow-card-text">{t(ui.score, { score, max })}</p>
          <div className="ow-row">
            <button className="ow-btn ow-btn-small" onClick={again}>
              🔁 {L(ui.again)}
            </button>
          </div>
          <button className="ow-btn ow-btn-go" onClick={() => setModal(null)} autoFocus>
            {L(ui.close)}
          </button>
        </>
      );
    } else if (modal.kind === "file") {
      body = (
        <>
          <div className="cq-kicker">📒 {L(ui.caseFile)}</div>
          <p className="ow-card-text">{t(ui.returned, { n: c.delivered.length, total })}</p>
          <div className="cq-file">
            {c.items.map((id) => {
              const a = byId[id];
              const home = c.delivered.indexOf(id) >= 0;
              const e = a ? eraOf[a.era] : null;
              return (
                <div key={id} className={"cq-file-item" + (home ? " home" : "")}>
                  <span className="cq-file-icon">{a?.icon}</span>
                  <span className="cq-file-name">{L(a?.name)}</span>
                  <span>{home && e ? e.icon + " ✓" : c.carrying === id ? "🤲" : "❔"}</span>
                </div>
              );
            })}
          </div>
          <button className="ow-btn ow-btn-go" onClick={() => setModal(null)} autoFocus>
            {L(ui.close)}
          </button>
        </>
      );
    }
  }

  return (
    <>
      {c.phase !== "intro" && (
        <div className="cq-case">
          <button className="cq-case-chip" onClick={() => setModal({ kind: "file" })} aria-label={L(ui.caseFile)}>
            🔍 <b>{c.phase === "done" ? "✓" : t(ui.returned, { n: c.delivered.length, total })}</b>
          </button>
          {carrying && (
            <div className="cq-carry" aria-label={L(ui.carrying)}>
              <span className="cq-carry-icon">{carrying.icon}</span>
              <span className="cq-carry-name">{L(carrying.name)}</span>
            </div>
          )}
          {c.phase === "timeline" && (
            <button className="cq-case-chip cq-go-dial" onClick={() => setModal({ kind: "dial" })}>
              ⏳ {L(ui.dial)}
            </button>
          )}
        </div>
      )}
      {toast && !modal && (
        <div className="cq-toast" onPointerDown={() => setToast("")}>
          {toast}
        </div>
      )}
      {modal && body && (
        <div className="ow-modal cq-modal" onPointerDown={(e) => e.target === e.currentTarget && modal.kind !== "intro" && modal.kind !== "result" && setModal(null)}>
          <div className="ow-card ow-info cq-card" role="dialog" aria-modal="true">
            {body}
          </div>
        </div>
      )}
    </>
  );
}
