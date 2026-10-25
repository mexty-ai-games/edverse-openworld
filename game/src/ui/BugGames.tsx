// The Bug Games, DOM side: six events, one after another. For each, the explorer picks the athlete from
// their team (creatures they have found; the cat flea is a guest) and then the time of day. Knowledge wins:
// the champion of that real talent, at the time it shows best. A wrong pick gets kind words that say why
// ("A flea is a jumper, not a puller"), then another try. Each pick -> mexty.progress.answer; the round ->
// complete(first-try events, events played). The podium celebrates the team with a leaf medal.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMexty } from "@mexty/sdk";
import type { BugGamesProps, ExpeditionProps, GamesEvent, GuideSpecies, T } from "../block";
import type { Game } from "../game/state";
import { useExp } from "../game/expedition";
import { STAGE } from "../game/quests";
import { PLAY_SECONDS, useGames } from "../game/bugGames";
import { ARENA_PIECES } from "../game/layout";
import { pieceToWorld, pieceView } from "../scene/BugGames3D";
import { sound } from "../audio";
import { SpeciesPic } from "./FieldKit";
import "./games.css";

type View = null | "intro" | "event" | "show" | "result" | "end";

interface Round {
  i: number;
  stage: "athlete" | "time";
  pick: string | null;
  cTries: number;
  tTries: number;
  score: number;
  played: number;
  msg: string;
  lastOk: boolean;
  /** Champions of the events won on the first try. */
  wins: string[];
}

const FRESH: Round = { i: 0, stage: "athlete", pick: null, cTries: 0, tTries: 0, score: 0, played: 0, msg: "", lastOk: false, wins: [] };

export function BugGames({ games, exp, t, game, young, blocked, onBusy }: {
  games: BugGamesProps;
  exp: ExpeditionProps;
  t: T;
  game: Game;
  young: boolean;
  blocked: boolean;
  onBusy: (b: boolean) => void;
}) {
  const mexty = useMexty();
  const ui = games.ui;
  const save = useExp((s) => s.save);
  const [view, setView] = useState<View>(null);
  const [r, setR] = useState<Round>(FRESH);
  const [time, setTime] = useState<string | null>(null);
  const events = games.events || [];
  const spById = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);
  // the team: every insect (or small creature) the explorer has found, and the flea as a guest
  const team = useMemo(() => {
    const out: { sp: GuideSpecies; guest: boolean }[] = [];
    for (const tl of games.talents || []) {
      const sp = spById[tl.species];
      if (!sp) continue;
      const seen = !!(save.g[sp.id] && save.g[sp.id].st & STAGE.seen);
      if (seen || sp.id === "flea") out.push({ sp, guest: sp.id === "flea" && !seen });
    }
    return out;
  }, [games.talents, spById, save.g]);
  const onTeam = (id: string) => team.some((x) => x.sp.id === id);

  useEffect(() => onBusy(view !== null), [view, onBusy]);

  // the camera looks at the piece of the event being played; the explorer stands beside it
  const focus = useCallback(
    (pieceKey: string | null) => {
      if (!pieceKey) {
        game.cam.focus = null;
        return;
      }
      const v = pieceView(pieceKey);
      game.walkTo = null;
      game.me.x = v.stand.x;
      game.me.z = v.stand.z;
      game.me.ry = Math.atan2(v.x - v.stand.x, v.z - v.stand.z);
      game.cam.focus = { x: v.x, y: v.y, z: v.z, d: v.d };
    },
    [game],
  );
  useEffect(() => () => {
    game.cam.focus = null;
  }, [game]);

  const ev: GamesEvent | undefined = events[r.i];
  useEffect(() => {
    if ((view === "event" || view === "show" || view === "result") && ev) focus(ev.piece);
    else if (view === "end") focus("podium");
    else if (view === "intro") focus("scoreboard");
    else focus(null);
  }, [view, ev, focus]);

  // the arena opens when the explorer walks up to it (the action button) or taps a piece
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<{ kind: string }>).detail;
      if (!f || f.kind !== "games" || game.mode !== "play" || view) return;
      setView("intro");
      sound.sfx("chime", 0.7);
    };
    window.addEventListener("ow-open", h);
    return () => window.removeEventListener("ow-open", h);
  }, [game, view]);

  const answer = (questionId: string, question: string, correct: boolean, attempt: number) => {
    try {
      mexty.progress.answer({ questionId, question, correct, attempt });
    } catch {
      /* outside EdVerse */
    }
  };
  const nameOf = (id: string) => (spById[id] ? t(spById[id].name) : id);
  const board = (title: string, line1: string, line2: string, iconUrl: string, stars: number) => useGames.getState().setBoard({ title, line1, line2, iconUrl, stars });

  const start = () => {
    sound.sfx("success", 0.6);
    setR(FRESH);
    setTime(null);
    useGames.setState({ podium: null });
    board(t(ui.board), t(ui.title), "", "", -1);
    setView("event");
  };
  const close = () => {
    useGames.setState({ play: null });
    setView(null);
  };

  const pickAthlete = (id: string) => {
    if (!ev) return;
    const ok = id === ev.winner;
    const attempt = r.cTries + 1;
    answer("games:" + ev.id + ":athlete", t(ev.name) + " — " + t(ui.pickAthlete), ok, attempt);
    if (ok) {
      sound.sfx("chime", 0.7);
      setR({ ...r, pick: id, cTries: attempt, stage: "time", msg: t(ui.rightCreature) });
      return;
    }
    sound.sfx("pop", 0.5);
    const tl = (games.talents || []).find((x) => x.species === id);
    const msg =
      ev.almostSpecies && ev.almostSpecies.indexOf(id) >= 0 && t(ev.almost)
        ? t(ev.almost)
        : tl
          ? t(ui.wrongCreature, { a: t(tl.a), talent: t(tl.talent), needs: t(ev.needs) })
          : t(ui.wrongCreature, { a: nameOf(id), talent: "?", needs: t(ev.needs) });
    // the athlete has a go anyway (gently), then the kind words
    show(id, "noon", false, msg, { ...r, cTries: attempt });
  };

  const pickTime = (tm: string) => {
    if (!ev || !r.pick) return;
    setTime(tm);
    const ok = ev.times.indexOf(tm) >= 0;
    const attempt = r.tTries + 1;
    answer("games:" + ev.id + ":time", t(ev.name) + " — " + t(ui.pickTime), ok, attempt);
    show(r.pick, tm, ok, ok ? "" : t(ev.wrongTime), { ...r, tTries: attempt });
  };

  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (species: string, tm: string, ok: boolean, msg: string, next: Round) => {
    if (!ev) return;
    setTime(tm);
    useGames.getState().setPlay({ event: ev.id, species, time: tm, ok, at: performance.now() });
    const sp = spById[species];
    board(ev.icon + " " + t(ev.name), sp ? t(sp.name) : species, ok ? "" : "…", sp ? sp.iconUrl : "", -1);
    setView("show");
    setR(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        if (ok) {
          const first = next.cTries === 1 && next.tTries === 1;
          const stars = first ? 3 : next.cTries + next.tTries <= 3 ? 2 : 1;
          board(ev.icon + " " + t(ev.name), t(ev.score), t(ui.won), sp ? sp.iconUrl : "", stars);
          sound.sfx("success", 0.9);
          setR({ ...next, score: next.score + (first ? 1 : 0), played: next.played + 1, msg: "", lastOk: first, wins: first ? next.wins.concat(ev.winner) : next.wins });
          setView("result");
        } else {
          useGames.setState({ play: null });
          setR({ ...next, msg, stage: next.stage === "time" || (next.pick && next.pick === ev.winner) ? "time" : "athlete" });
          setView("event");
        }
      },
      ok ? PLAY_SECONDS * 1000 + 300 : 2200,
    );
  };

  const nextEvent = (skipped = false) => {
    useGames.setState({ play: null });
    setTime(null);
    const i = r.i + 1;
    if (i < events.length) {
      setR({ ...r, i, stage: "athlete", pick: null, cTries: 0, tTries: 0, msg: "", played: r.played });
      setView("event");
      return;
    }
    finish(skipped ? r : r);
  };

  const finish = (fr: Round) => {
    const max = Math.max(1, fr.played);
    const medal = fr.score >= Math.ceil(max * 0.8) ? "gold" : fr.score >= Math.ceil(max / 2) ? "silver" : "bronze";
    try {
      mexty.progress.complete(fr.score, max);
    } catch {
      /* outside EdVerse */
    }
    const st = useExp.getState();
    const bg = st.save.bg || { n: 0, best: 0 };
    st.setSave({ ...st.save, bg: { n: bg.n + 1, best: Math.max(bg.best, fr.score) } });
    if (fr.played > 0) st.emit({ kind: "games", id: "round", zone: "idea-grove" });
    // the team's champions stand on the podium: the winners of the events won first try (then the others)
    const champs = fr.wins.concat(events.map((e) => e.winner).filter((w) => onTeam(w) && fr.wins.indexOf(w) < 0)).slice(0, 3);
    useGames.setState({ podium: { medal, at: performance.now(), team: champs }, play: null });
    board("🏅 " + t(ui.title), t(ui.score, { n: fr.score, total: max }), t(medal === "gold" ? ui.medalGold : medal === "silver" ? ui.medalSilver : ui.medalBronze), "", Math.round((fr.score / max) * 3));
    // the explorer cheers beside the podium
    const p = ARENA_PIECES.find((x) => x.key === "podium")!;
    const beside = pieceToWorld(p, 1.45, 0.55);
    game.me.x = beside.x;
    game.me.z = beside.z;
    game.me.ry = p.ry;
    game.emote("cheer");
    sound.sfx("success", 1);
    setView("end");
  };

  // keyboard: Esc closes, 1-9 pick an athlete / a time
  useEffect(() => {
    if (!view) return;
    const k = (e: KeyboardEvent) => {
      if (e.code === "Escape") close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  if (!view || blocked) return null;
  const tm = (games.times || []).find((x) => x.id === time);
  const overlay = view === "show" && tm ? <div className={"bg-time bg-time-" + tm.id} style={{ ["--tint" as string]: tm.light, ["--k" as string]: String(1 - Math.min(1, tm.intensity)) } as React.CSSProperties} aria-hidden /> : null;
  const head = (
    <div className="bg-head">
      <div className="bg-title">🏅 {t(ui.title)}</div>
      <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={close}>
        ✕
      </button>
    </div>
  );

  if (view === "intro")
    return (
      <div className="bg-sheet ow-card" role="dialog" aria-label={t(ui.title)}>
        {head}
        <p className="bg-text">{t(young ? ui.introEasy : ui.intro)}</p>
        <div className="bg-events">
          {events.map((e) => (
            <span key={e.id} className="bg-ev-chip">
              <span aria-hidden>{e.icon}</span> {t(e.name)}
            </span>
          ))}
        </div>
        {team.length <= 1 && <div className="ex-kind">{t(ui.needGuide)}</div>}
        <button className="ow-btn ow-btn-go" onClick={start} autoFocus>
          🏁 {(save.bg && save.bg.n) || 0 ? t(ui.again) : t(ui.start)}
        </button>
      </div>
    );

  if (view === "end")
    return (
      <div className="bg-sheet ow-card" role="dialog" aria-label={t(ui.title)}>
        {head}
        <div className="bg-medal" aria-hidden>
          {r.score >= Math.ceil(Math.max(1, r.played) * 0.8) ? "🥇" : r.score >= Math.ceil(Math.max(1, r.played) / 2) ? "🥈" : "🥉"}
        </div>
        <p className="bg-text strong">{t(ui.roundDone, { n: r.score, total: Math.max(1, r.played) })}</p>
        <div className="ow-row">
          <button className="ow-btn ow-btn-small" onClick={start}>
            🔁 {t(ui.again)}
          </button>
          <button className="ow-btn ow-btn-small" onClick={close} autoFocus>
            {t(ui.close)}
          </button>
        </div>
      </div>
    );

  if (!ev) return null;
  const stepNo = (
    <div className="bg-step">
      {t(ui.event, { n: r.i + 1, total: events.length })}
      <span className="bg-dots" aria-hidden>
        {events.map((e, i) => (
          <i key={e.id} className={i < r.i ? "done" : i === r.i ? "now" : ""} />
        ))}
      </span>
    </div>
  );

  if (view === "show")
    return (
      <>
        {overlay}
        <div className="bg-banner ow-card" aria-live="polite">
          <span aria-hidden>{ev.icon}</span> {t(ev.name)} — {t(ui.watch)} {tm ? tm.icon : ""}
        </div>
      </>
    );

  if (view === "result") {
    const winner = spById[ev.winner];
    return (
      <div className="bg-sheet ow-card" role="dialog" aria-label={t(ev.name)}>
        {head}
        {stepNo}
        <div className="bg-result">
          {winner && <SpeciesPic s={winner} known big />}
          <div>
            <div className="bg-won">
              🏆 {t(ui.won)} {r.lastOk ? "⭐" : ""}
            </div>
            <div className="bg-score">{t(ev.score)}</div>
          </div>
        </div>
        <p className="bg-text">{t(young ? ev.factEasy : ev.fact)}</p>
        <div className="ex-source">{t(exp.ui.source, { source: ev.source })}</div>
        {ev.winner === "flea" && <p className="ex-small-text">🐾 {t(ui.fleaGuest)}</p>}
        <button className="ow-btn ow-btn-go" onClick={() => nextEvent()} autoFocus>
          {t(ui.next)} ➜
        </button>
      </div>
    );
  }

  // the event: who, then when
  const champion = onTeam(ev.winner);
  const wsp = spById[ev.winner];
  return (
    <div className="bg-sheet ow-card" role="dialog" aria-label={t(ev.name)}>
      {head}
      {stepNo}
      <div className="bg-event">
        <span className="bg-ev-icon" aria-hidden>
          {ev.icon}
        </span>
        <div>
          <div className="bg-ev-name">{t(ev.name)}</div>
          <div className="bg-text">{t(ev.goal)}</div>
        </div>
      </div>
      {!champion ? (
        <>
          <div className="ex-kind">{t(ui.notYet, { name: wsp ? t(wsp.name) : ev.winner, where: wsp && wsp.habitat ? t(wsp.habitat) : "" })}</div>
          <button className="ow-btn ow-btn-go" onClick={() => nextEvent(true)}>
            {t(ui.skip)} ➜
          </button>
        </>
      ) : r.stage === "athlete" ? (
        <>
          {r.msg && <div className="ex-kind" aria-live="polite">{r.msg}</div>}
          <div className="bg-label">{t(ui.pickAthlete)}</div>
          <div className="bg-team" role="group" aria-label={t(ui.team)}>
            {team.map(({ sp, guest }) => (
              <button key={sp.id} className="bg-athlete" onClick={() => pickAthlete(sp.id)}>
                <SpeciesPic s={sp} known />
                <span className="bg-ath-name">{t(sp.name)}</span>
                {guest && <span className="bg-guest">{t(ui.guest)}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {r.pick && spById[r.pick] && (
            <div className="bg-picked">
              <SpeciesPic s={spById[r.pick]} known /> <b>{t(spById[r.pick].name)}</b>
            </div>
          )}
          {r.msg && <div className={r.msg === t(ui.rightCreature) ? "ex-good" : "ex-kind"} aria-live="polite">{r.msg}</div>}
          <div className="bg-label">{t(ui.pickTime)}</div>
          <div className="bg-times" role="group">
            {(games.times || []).map((x) => (
              <button key={x.id} className={"bg-time-btn bg-tb-" + x.id} onClick={() => pickTime(x.id)}>
                <span className="bg-time-icon" aria-hidden>
                  {x.icon}
                </span>
                <span>{t(x.name)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
