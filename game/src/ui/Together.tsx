// Phase 3, "Together", DOM side: the controller (cloud save `together`, the shared rows of my age tile,
// the room's preset action messages, the BioBlitz clock, team-up finds, badges, the learning record) and
// the cards: a garden bed, a museum display, the BioBlitz, a team-up find, a badge. No free text anywhere:
// explorers act on each other only through presets (hold a tool out, a sticker, "show this creature").
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSave, useMexty } from "@mexty/sdk";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CoopFind, ExpeditionProps, GuideSpecies, T, TogetherProps } from "../block";
import type { ActMsg, Game, Peer, Target } from "../game/state";
import { useExp } from "../game/expedition";
import { STAGE, currentStep, stagesOf } from "../game/quests";
import { roomForAge, tileOf } from "../game/net";
import { makeShared, SharedIO, Row } from "../game/shared";
import {
  BEDS, Blitz, EMPTY_T, closeCard, queueCard, KEEPER_NICK, Plot, TSave, blitzEnd, blitzFromRows, canWater, cleanT, displaysFrom, gardenView, giveSticker, holderNear, mergeBlitz,
  minutesToNext, newBlitzId, plantIn, stickerCounts, useTogether, waterAt,
} from "../game/together";
import { sound } from "../audio";
import { useModel } from "../scene/assets";
import { PLOTS } from "../scene/Together3D";
import { SpeciesPic } from "./FieldKit";
import type { QuestEvent } from "../game/quests";
import "./together.css";
import { tgUi } from "../together/content";

type Mexty = ReturnType<typeof useMexty>;
const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const POLL_MS = LOCAL ? 2500 : 15000;
const PLANT_ICON = ["🌱", "🌿", "🌼"];

function answer(mexty: Mexty, questionId: string, question: string, correct = true) {
  try {
    mexty.progress.answer({ questionId, question, correct, attempt: 1 });
  } catch {
    /* outside EdVerse */
  }
}

/** The HUD's action-button label for phase 3 targets. */
export function togetherLabel(tg: Target, tp: TogetherProps, t: T): [string, string] | null {
  if (tg.kind === "tg:bed") return ["🌱", t(tgUi(tp).garden)];
  if (tg.kind === "tg:display") return ["🖼️", t(tgUi(tp).look)];
  if (tg.kind === "tg:blitz") return ["🔎", t(tgUi(tp).blitz)];
  return null;
}

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

export function Together({ tp, exp, t, game, zone, phase, young, blocked, onBusy }: {
  tp: TogetherProps;
  exp: ExpeditionProps;
  t: T;
  game: Game;
  zone: string;
  phase: "start" | "play";
  young: boolean;
  blocked: boolean;
  onBusy: (b: boolean) => void;
}) {
  const mexty = useMexty();
  const cloud = useCloudSave<TSave>("together", EMPTY_T);
  const save = useTogether((s) => s.save);
  const loaded = useTogether((s) => s.loaded);
  const card = useTogether((s) => s.card);
  const blitz = useTogether((s) => s.blitz);
  const coopNear = useTogether((s) => s.coopNear);
  const tile = useTogether((s) => s.tile);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const ui = tgUi(tp);
  const rules = tp.rules;
  const expSave = useExp((s) => s.save);
  const expMode = useExp((s) => s.mode);

  // ---------------------------------------------------------------- the save
  const lastWritten = useRef<TSave | null>(null);
  useEffect(() => {
    if (cloud.loading || useTogether.getState().loaded) return;
    const c = cleanT(cloud.value);
    lastWritten.current = c;
    useTogether.setState({ save: c, loaded: true });
  }, [cloud.loading, cloud.value]);
  useEffect(() => {
    if (!loaded || save === lastWritten.current) return;
    const id = window.setTimeout(() => {
      lastWritten.current = save;
      cloud.save(save);
    }, 600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, loaded]);
  const setSave = useCallback((f: (s: TSave) => TSave) => {
    const st = useTogether.getState();
    st.setSave(f(st.save));
  }, []);

  // ---------------------------------------------------------------- my age tile (the shared rows are only mixed within it)
  useEffect(() => {
    let alive = true;
    mexty
      .getPlayer()
      .then((p) => alive && useTogether.setState({ tile: tileOf(roomForAge(p.ageMin, p.ageMax, "idea-grove")) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mexty]);
  const shared = useMemo<SharedIO>(() => makeShared(mexty, () => game.nickname), [mexty, game]);
  const rows = useRef<Record<string, Row[]>>({});
  const myNick = useRef("");
  const speciesIds = useMemo(() => new Set((exp.species || []).map((s) => s.id)), [exp.species]);
  const stickerIds = useMemo(() => new Set(tp.stickers.map((s) => s.id)), [tp.stickers]);
  const speciesBy = useMemo(() => {
    const m: Record<string, GuideSpecies> = {};
    for (const s of exp.species || []) m[s.id] = s;
    return m;
  }, [exp.species]);

  /** Rebuild the garden, the museum and the room's BioBlitz from the rows and my save. */
  const rebuild = useCallback(() => {
    const st = useTogether.getState();
    const now = Date.now();
    const me = Object.values(rows.current).flat().find((r) => r.mine);
    myNick.current = (me && me.nickname) || game.nickname;
    const plots = gardenView(rows.current["ow-garden"] || [], st.tile, st.save, myNick.current, tp, now);
    const displays = displaysFrom(rows.current["ow-museum"] || [], st.tile, st.save, myNick.current, tp.keeperPhotos, speciesIds, 11);
    const stickers = stickerCounts(rows.current["ow-stickers"] || [], st.tile, st.save, stickerIds);
    let b = blitzFromRows(rows.current["ow-bioblitz"] || [], st.tile, now, rules);
    // my own view of the event I joined (and finds the server has not echoed yet)
    if (st.save.bb.ev && now < st.save.bb.s + rules.blitzMinutes * 60000) b = mergeBlitz(b, { id: st.save.bb.ev, start: st.save.bb.s, found: st.save.bb.f, team: [myNick.current] });
    b = mergeBlitz(b, st.blitz && now < blitzEnd(st.blitz, rules) ? st.blitz : null);
    useTogether.setState({ plots, displays, stickers, blitz: b });
  }, [game, tp, speciesIds, stickerIds, rules]);

  useEffect(() => {
    if (phase !== "play") return;
    let alive = true;
    const poll = async () => {
      for (const c of ["ow-garden", "ow-museum", "ow-stickers", "ow-bioblitz"]) {
        const r = await shared.list(c);
        if (!alive) return;
        rows.current[c] = r;
      }
      rebuild();
    };
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [phase, shared, rebuild]);
  useEffect(() => {
    if (loaded) rebuild();
  }, [save, tile, loaded, rebuild]);

  // my rows follow my save (one row per collection)
  const wrote = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!loaded || !tile) return;
    const put = (c: string, key: string, data: Record<string, unknown>) => {
      const sig = JSON.stringify(data);
      if (wrote.current[c] === sig) return;
      wrote.current[c] = sig;
      shared.set(c, key, data);
    };
    put("ow-garden", "plot", { v: 1, tile, p: save.plots, w: save.waters });
    put("ow-museum", "case", { v: 1, tile, ph: save.museum });
    put("ow-stickers", "given", { v: 1, tile, g: save.stk });
    if (save.bb.ev) put("ow-bioblitz", "blitz", { v: 1, tile, i: save.bb.ev, s: save.bb.s, f: save.bb.f });
  }, [save, tile, loaded, shared]);

  // ---------------------------------------------------------------- badges and the learning record
  const award = useCallback(
    (id: string) => {
      const st = useTogether.getState();
      if (st.save.badges.indexOf(id) >= 0) return;
      setSave((s) => ({ ...s, badges: s.badges.concat(id) }));
      try {
        mexty.achievements.unlock("ow-" + id);
      } catch {
        /* outside EdVerse */
      }
      sound.sfx("success", 0.9);
      queueCard({ kind: "badge", id });
    },
    [mexty, setSave],
  );
  const emit = useCallback((kind: "plant" | "water" | "pollinate" | "museum" | "sticker" | "coop" | "bioblitz" | "help", id: string) => {
    // phase 3 kinds go through the same quest engine (its step kinds are plain strings in the props)
    useExp.getState().emit({ kind, id, zone: zoneRef.current } as unknown as QuestEvent);
  }, []);
  const toast = (icon: string, text: string) => useExp.getState().showToast(icon, text);

  // a plant of mine came into flower: the gardener badge
  const plots = useTogether((s) => s.plots);
  useEffect(() => {
    if (!loaded) return;
    const bloom = plots.find((p) => p.mine && p.stage === 2);
    if (bloom && save.badges.indexOf("gardener") < 0) {
      setSave((s) => ({ ...s, bloomed: s.bloomed + 1 }));
      award("gardener");
    }
  }, [plots, loaded, save.badges, award, setSave]);
  // growth goes on while the explorer watches
  useEffect(() => {
    const id = window.setInterval(() => useTogether.getState().loaded && rebuild(), 20000);
    return () => window.clearInterval(id);
  }, [rebuild]);

  // a beginner: few Field Guide pages yet (others may show them creatures)
  useEffect(() => {
    game.newbie = Object.keys(expSave.g || {}).length < rules.newcomerPages;
  }, [expSave, rules.newcomerPages, game]);

  // ---------------------------------------------------------------- the BioBlitz
  const joined = !!blitz && save.bb.ev === blitz.id;
  const startBlitz = useCallback(() => {
    const now = Date.now();
    const st = useTogether.getState();
    const cur = st.blitz && now < blitzEnd(st.blitz, rules) ? st.blitz : null;
    const b: Blitz = cur || { id: newBlitzId(now), start: now, found: [], team: [] };
    setSave((s) => ({ ...s, bb: { ...s.bb, ev: b.id, s: b.start, f: [] } }));
    useTogether.setState({ blitz: mergeBlitz(b, { ...b, team: [game.nickname] }) });
    if (game.act) game.act({ t: "bb", i: b.id, s: b.start, f: [] });
    sound.sfx("chime", 0.9);
  }, [rules, setSave, game]);
  // the end of the event I joined: the team's count, a badge when the goal is met, the learning record
  const finishing = useRef("");
  useEffect(() => {
    if (!loaded) return;
    const iv = window.setInterval(() => {
      const st = useTogether.getState();
      const bb = st.save.bb;
      if (!bb.ev || Date.now() < bb.s + rules.blitzMinutes * 60000 || finishing.current === bb.ev) return;
      finishing.current = bb.ev;
      // everyone's finds for this event (rows stay listed after it ends)
      let found = bb.f.slice();
      for (const r of rows.current["ow-bioblitz"] || []) {
        const d = r.data as { tile?: string; i?: string; f?: unknown };
        if (d.i === bb.ev && d.tile === st.tile && Array.isArray(d.f)) for (const f of d.f) if (typeof f === "string" && speciesIds.has(f) && found.indexOf(f) < 0) found.push(f);
      }
      if (st.blitz && st.blitz.id === bb.ev) for (const f of st.blitz.found) if (found.indexOf(f) < 0) found.push(f);
      found = found.slice(0, 60);
      const goal = rules.blitzGoal;
      const met = found.length >= goal;
      setSave((s) => ({ ...s, bb: { n: s.bb.n + 1, best: Math.max(s.bb.best, found.length), ev: "", s: 0, f: [] } }));
      try {
        mexty.progress.complete(Math.min(found.length, goal), goal);
      } catch {
        /* outside EdVerse */
      }
      emit("bioblitz", bb.ev);
      useTogether.setState({ blitz: null });
      queueCard({ kind: "blitzResult", count: found.length, goal, met });
      sound.sfx("success", 0.9);
      if (met) award("blitz");
    }, 1000);
    return () => window.clearInterval(iv);
  }, [loaded, rules, speciesIds, setSave, mexty, emit, award]);

  // ---------------------------------------------------------------- finds: the BioBlitz, team-up photos, the pollinator chart
  const coops = useMemo(() => tp.coop.filter((c) => c.zone === zone), [tp.coop, zone]);
  const coopDone = useCallback(
    (c: CoopFind, by: string, holder: boolean) => {
      const st = useTogether.getState();
      const first = st.save.coop.indexOf(c.id) < 0;
      if (first) setSave((s) => ({ ...s, coop: s.coop.concat(c.id) }));
      answer(mexty, "coop:" + c.id, t(ui.teamUp) + " — " + t((speciesBy[c.species] || { name: c.species }).name));
      emit("coop", c.id);
      sound.sfx("success", 0.9);
      if (first) queueCard({ kind: "coop", id: c.id, by, holder });
      else toast("🤝", holder && by ? t(ui.coopThanks, { name: by }) : t(ui.coopDone));
      if (st.save.badges.indexOf("teamup") < 0) award("teamup");
    },
    [mexty, t, ui, speciesBy, emit, setSave, award],
  );
  useEffect(() => {
    const h = (e: Event) => {
      const ev = (e as CustomEvent<{ kind: string; id: string; zone: string }>).detail;
      if (!ev) return;
      const st = useTogether.getState();
      // the BioBlitz: a new species for the team
      const b = st.blitz;
      if (b && st.save.bb.ev === b.id && Date.now() < blitzEnd(b, rules) && speciesIds.has(ev.id) && b.found.indexOf(ev.id) < 0) {
        const nb = { ...b, found: b.found.concat(ev.id) };
        useTogether.setState({ blitz: nb });
        setSave((s) => ({ ...s, bb: { ...s.bb, f: s.bb.f.indexOf(ev.id) < 0 ? s.bb.f.concat(ev.id).slice(0, 60) : s.bb.f } }));
        if (game.act) game.act({ t: "bb", i: b.id, s: b.start, f: nb.found });
        const sp = speciesBy[ev.id];
        toast("🔎", t(ui.blitzNew, { name: sp ? t(sp.name) : ev.id }));
      }
      // a team-up photo: someone holds the lantern near the creature
      if (ev.kind === "photo") {
        const c = coops.find((x) => x.act === "camera" && x.species === ev.id);
        if (c && !game.me.hold) {
          const cr = game.creatures.find((x) => x.species === c.species && !x.hidden);
          const by = cr ? holderNear(game, c, cr.obj.position.x, cr.obj.position.z, st.helper) : null;
          if (by !== null) {
            coopDone(c, by, false);
            if (by && game.act) game.act({ t: "ty", c: c.id, to: by });
          }
        }
      }
      // the pollinator chart: a garden pollinator photographed while it drinks at a garden flower
      if (ev.kind === "observe" && zoneRef.current === "idea-grove") {
        const where = st.feeding["garden-" + ev.id];
        if (where) {
          const plant = where.split(":")[2];
          const pair = ev.id + ">" + plant;
          if (st.save.pairs.indexOf(pair) < 0) {
            setSave((s) => ({ ...s, pairs: s.pairs.concat(pair).slice(0, 40) }));
            const pl = tp.plants.find((p) => p.id === plant);
            const sp = speciesBy[ev.id];
            answer(mexty, "garden:" + pair, t(ui.chart) + " — " + (sp ? t(sp.name) : ev.id) + " / " + (pl ? t(pl.name) : plant));
            toast(sp ? sp.icon : "🐝", t(ui.pairFound, { who: sp ? t(sp.name) : ev.id, what: pl ? t(pl.name) : plant }));
          }
          emit("pollinate", pair);
        }
      }
    };
    window.addEventListener("ow-find", h);
    return () => window.removeEventListener("ow-find", h);
  }, [rules, speciesIds, speciesBy, setSave, game, t, ui, coops, coopDone, tp.plants, mexty, emit]);

  // the net and the jar: a team-up catch. The creature can be netted only while someone holds the jar open
  // close by (a kind tip says so to an explorer trying alone); a catch then is a find for both.
  const tipAt = useRef(0);
  useEffect(() => {
    const nets = coops.filter((c) => c.act === "net");
    if (!nets.length) return;
    const iv = window.setInterval(() => {
      const helper = useTogether.getState().helper;
      for (const c of nets) {
        const cr = game.creatures.find((x) => x.species === c.species && !x.hidden);
        if (!cr) continue;
        const by = holderNear(game, c, cr.obj.position.x, cr.obj.position.z, helper, 5);
        cr.catchable = by !== null;
        const ex = useExp.getState();
        if (!cr.catchable && ex.mode === "net" && Math.hypot(cr.obj.position.x - game.me.x, cr.obj.position.z - game.me.z) < 3.5 && Date.now() - tipAt.current > 8000) {
          tipAt.current = Date.now();
          const tool = (exp.tools || []).find((x) => x.id === c.hold);
          toast("🤝", t(ui.needPartner, { hold: tool ? t(tool.name) : c.hold }));
        }
      }
    }, 300);
    let jarKey = "";
    const unsub = useExp.subscribe((st) => {
      const j = st.jar;
      const k = j ? j.key + ":" + j.x + ":" + j.z : "";
      if (k === jarKey) return;
      jarKey = k;
      const c = j ? nets.find((x) => x.species === j.species) : null;
      if (!j || !c) return;
      const by = holderNear(game, c, j.x, j.z, useTogether.getState().helper, 6);
      coopDone(c, by || "", false);
      if (by && game.act) game.act({ t: "ty", c: c.id, to: by });
    });
    return () => {
      window.clearInterval(iv);
      unsub();
    };
  }, [coops, game, exp.tools, t, ui, coopDone]);

  // ---------------------------------------------------------------- the room's preset messages
  useEffect(() => {
    const h = (m: ActMsg, from: Peer) => {
      const st = useTogether.getState();
      if (m.t === "bb") {
        const now = Date.now();
        const b: Blitz = { id: String(m.i), start: Number(m.s), found: (m.f as string[]).filter((x) => speciesIds.has(x)), team: [from.nick] };
        if (now >= blitzEnd(b, rules) || b.start > now + 60000) return;
        useTogether.setState({ blitz: mergeBlitz(st.blitz, b) });
      } else if (m.t === "ty" && m.to === game.nickname) {
        const c = tp.coop.find((x) => x.id === m.c);
        if (c && game.me.hold === c.hold) coopDone(c, from.nick, true);
      } else if (m.t === "sh" && m.to === game.nickname) {
        const sp = speciesBy[String(m.sp)];
        if (!sp) return;
        useTogether.setState({ beacon: { species: sp.id, until: Date.now() + 25000, by: from.nick } });
        useExp.getState().seen(sp.id);
        toast("✨", t(ui.shownBy, { name: from.nick, what: t(sp.name) }));
        sound.sfx("chime", 0.9);
      }
    };
    game.onAct.push(h);
    return () => {
      game.onAct = game.onAct.filter((x) => x !== h);
    };
  }, [game, rules, speciesIds, speciesBy, tp.coop, coopDone, t, ui]);
  // the event I am in is said again now and then, so explorers who arrive later see it
  useEffect(() => {
    const iv = window.setInterval(() => {
      const st = useTogether.getState();
      const b = st.blitz;
      if (b && st.save.bb.ev === b.id && Date.now() < blitzEnd(b, rules) && game.act) game.act({ t: "bb", i: b.id, s: b.start, f: b.found });
    }, 5000);
    return () => window.clearInterval(iv);
  }, [game, rules]);

  // ---------------------------------------------------------------- team-up finds nearby, and the Keeper's helper for a lone explorer
  const alone = useRef(0);
  useEffect(() => {
    let last = performance.now();
    const iv = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const st = useTogether.getState();
      if (game.mode !== "play") return;
      let near: CoopFind | null = null;
      let pos: { x: number; z: number } | null = null;
      for (const c of coops) {
        const cr = game.creatures.find((x) => x.species === c.species && !x.hidden);
        if (cr && Math.hypot(cr.obj.position.x - game.me.x, cr.obj.position.z - game.me.z) < 7) {
          near = c;
          pos = { x: cr.obj.position.x, z: cr.obj.position.z };
          break;
        }
      }
      if ((near ? near.id : null) !== st.coopNear) useTogether.setState({ coopNear: near ? near.id : null });
      if (!near || !pos) {
        if (game.me.hold) {
          game.me.hold = game.me.holdC = "";
          if (game.pushState) game.pushState();
        }
        alone.current = 0;
        if (st.helper && Math.hypot(st.helper.x - game.me.x, st.helper.z - game.me.z) > 14) useTogether.setState({ helper: null });
        return;
      }
      const peerHolds = holderNear(game, near, pos.x, pos.z, null);
      if (peerHolds !== null || game.me.hold) {
        alone.current = 0;
        return;
      }
      // the helper comes only to an explorer trying this find (its tool out, or the team-up step on)
      const ex = useExp.getState();
      const step = ex.quests ? currentStep(ex.quests, ex.save) : null;
      const trying = ex.mode === (near.act === "camera" ? "camera" : near.act) || (!!step && step.kind === "coop");
      if (!trying) return;
      alone.current += dt;
      // other explorers close by: give them a chance to team up first
      let others = false;
      game.peers.forEach((p) => {
        if (!game.hidden.has(p.id) && Math.hypot(p.x - game.me.x, p.z - game.me.z) < 12) others = true;
      });
      if (!st.helper && alone.current >= rules.helperAfter * (others ? 2.25 : 1)) {
        // the Keeper's helper comes to stand by the creature, between it and the explorer, holding the tool out
        const dx = game.me.x - pos.x;
        const dz = game.me.z - pos.z;
        const d = Math.max(0.01, Math.hypot(dx, dz));
        const hx = pos.x + (dx / d) * 1.3 + (dz / d) * 1.0;
        const hz = pos.z + (dz / d) * 1.3 - (dx / d) * 1.0;
        useTogether.setState({ helper: { coop: near.id, x: hx, z: hz, ry: Math.atan2(pos.x - hx, pos.z - hz), at: performance.now() } });
        const line = (exp.keeper.lines || []).find((l) => l.id === "helper");
        if (line && line.audio) sound.voice([t(line.audio)]);
        toast("🧑‍🌾", t(ui.helperComing));
      }
    }, 300);
    return () => window.clearInterval(iv);
  }, [coops, game, rules.helperAfter, exp.keeper.lines, t, ui]);
  useEffect(() => {
    useTogether.setState({ helper: null, coopNear: null, beacon: null });
    game.me.hold = game.me.holdC = "";
  }, [zone, game]);

  // ---------------------------------------------------------------- opening things (tap, or the HUD's action button)
  const pending = useRef<Target | null>(null);
  const openTarget = useCallback(
    (f: Target) => {
      const st = useTogether.getState();
      if (f.kind === "tg:bed") useTogether.setState({ card: { kind: "bed", bed: Number(f.ref) } });
      else if (f.kind === "tg:display") useTogether.setState({ card: { kind: "display", owner: String(f.ref) } });
      else if (f.kind === "tg:blitz") useTogether.setState({ card: { kind: "blitz" } });
      else return;
      void st;
      sound.sfx("pop", 0.7);
    },
    [],
  );
  useEffect(() => {
    const h = (e: Event) => {
      const f = (e as CustomEvent<Target>).detail;
      if (!f || String(f.kind).indexOf("tg:") !== 0 || game.mode !== "play") return;
      const d = Math.hypot(f.x - game.me.x, f.z - game.me.z);
      if (d <= f.reach + 0.6) openTarget(f);
      else {
        const k = (d - 1.0) / d;
        game.walkTo = { x: game.me.x + (f.x - game.me.x) * k, z: game.me.z + (f.z - game.me.z) * k };
        pending.current = f;
      }
    };
    window.addEventListener("ow-open", h);
    const iv = window.setInterval(() => {
      const p = pending.current;
      if (!p) return;
      if (Math.hypot(p.x - game.me.x, p.z - game.me.z) <= p.reach + 0.6) {
        pending.current = null;
        openTarget(p);
      } else if (!game.walkTo) pending.current = null;
    }, 200);
    return () => {
      window.removeEventListener("ow-open", h);
      window.clearInterval(iv);
    };
  }, [game, openTarget]);
  useEffect(() => {
    if (phase !== "play") useTogether.setState({ card: null, cardQueue: [] });
  }, [phase]);
  useEffect(() => {
    // a card about a place closes when leaving it; reward cards stay
    const c = useTogether.getState().card;
    if (c && (c.kind === "bed" || c.kind === "display" || c.kind === "blitz")) closeCard();
  }, [zone]);
  useEffect(() => onBusy(!!card), [card, onBusy]);

  // ---------------------------------------------------------------- show a beginner (a chip under an open Field Guide page)
  const guidePage = useExp((s) => (s.mode === "guide" ? s.page : null));
  const shown = useCallback(
    (sp: GuideSpecies, nick: string) => {
      setSave((x) => ({ ...x, helped: x.helped + 1 }));
      emit("help", sp.id);
      answer(mexty, "help:" + sp.id, t(ui.showBeginner, { name: "" }) + " " + t(sp.name));
      toast("✨", t(ui.helped, { what: t(sp.name), name: nick }));
      sound.sfx("success", 0.8);
      if (useTogether.getState().save.badges.indexOf("helper") < 0) award("helper");
    },
    [setSave, emit, mexty, t, ui, award],
  );

  if (LOCAL) (window as unknown as Record<string, unknown>).__owTg = useTogether;
  if (phase !== "play") return null;
  const now = Date.now();
  const live = blitz && now < blitzEnd(blitz, rules);
  return (
    <>
      {live && joined && !card && <BlitzChip t={t} tp={tp} b={blitz!} />}
      {live && !joined && !card && !blocked && (
        <button className="tg-offer" onClick={() => (zone === "idea-grove" ? useTogether.setState({ card: { kind: "blitz" } }) : toast("🔎", t(ui.blitzOn)))}>
          🔎 {t(ui.blitzOn)}
        </button>
      )}
      {guidePage && speciesBy[guidePage] && <ShowBeginner t={t} s={speciesBy[guidePage]} tp={tp} game={game} onShown={(nick) => shown(speciesBy[guidePage], nick)} />}
      {coopNear && !card && !blocked && expMode !== "camera" && expMode !== "net" && <CoopPanel tp={tp} exp={exp} t={t} game={game} />}
      {card && !blocked && (
        <TogetherCard
          tp={tp}
          exp={exp}
          t={t}
          game={game}
          young={young}
          setSave={setSave}
          emit={emit}
          startBlitz={startBlitz}
          speciesBy={speciesBy}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ the BioBlitz chip (only for explorers who joined: the one place a clock is shown)
function BlitzChip({ t, tp, b }: { t: T; tp: TogetherProps; b: Blitz }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = blitzEnd(b, tp.rules) - Date.now();
  return (
    <button className="tg-blitz-chip" onClick={() => useTogether.setState({ card: { kind: "blitz" } })}>
      <span aria-hidden>🔎</span> {t(tgUi(tp).blitzCount, { n: b.found.length, goal: tp.rules.blitzGoal })}
      <span className="tg-clock">⏳ {fmtClock(left)}</span>
    </button>
  );
}

// ------------------------------------------------------------------ team-up panel
function CoopPanel({ tp, exp, t, game }: { tp: TogetherProps; exp: ExpeditionProps; t: T; game: Game }) {
  const id = useTogether((s) => s.coopNear);
  const helper = useTogether((s) => s.helper);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => tick((x) => x + 1), 500);
    return () => window.clearInterval(iv);
  }, []);
  const c = tp.coop.find((x) => x.id === id);
  if (!c) return null;
  const tool = (k: string) => (exp.tools || []).find((x) => x.id === k);
  const hold = tool(c.hold);
  const act = tool(c.act);
  const done = useTogether.getState().save.coop.indexOf(c.id) >= 0;
  const cr = game.creatures.find((x) => x.species === c.species && !x.hidden);
  const by = cr ? holderNear(game, c, cr.obj.position.x, cr.obj.position.z, helper) : null;
  const holding = game.me.hold === c.hold && game.me.holdC === c.id;
  const toggle = () => {
    if (holding) game.me.hold = game.me.holdC = "";
    else {
      game.me.hold = c.hold;
      game.me.holdC = c.id;
    }
    if (game.pushState) game.pushState();
    sound.sfx("pop", 0.6);
    tick((x) => x + 1);
  };
  return (
    <div className={"tg-coop ow-card" + (done ? " done" : "")} role="status">
      <div className="tg-coop-icons" aria-hidden>
        <span>{hold ? hold.icon : "🏮"}</span>
        <span className="tg-plus">+</span>
        <span>{act ? act.icon : "📷"}</span>
      </div>
      <div className="tg-coop-body">
        <div className="tg-coop-title">🤝 {t(tgUi(tp).teamUp)}</div>
        <div className="tg-coop-text">{t(tgUi(tp).teamNeed, { hold: hold ? t(hold.name) : c.hold, act: act ? t(act.name) : c.act })}</div>
        <div className="tg-coop-status">
          {holding ? "✅ " + t(tgUi(tp).holding) : by !== null ? "✅ " + (by ? t(tgUi(tp).friendHolding, { name: by }) : t(tgUi(tp).helperComing)) : "⏳ " + t(tgUi(tp).waitFriend)}
        </div>
      </div>
      <button className={"ow-btn tg-hold" + (holding ? " on" : "")} onClick={toggle}>
        {hold ? hold.icon : "🏮"} {t(holding ? tgUi(tp).stopHold : tgUi(tp).holdIt)}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ show a beginner a creature (on its Field Guide page)
function ShowBeginner({ t, s, tp, game, onShown }: { t: T; s: GuideSpecies; tp: TogetherProps; game: Game; onShown: (nick: string) => void }) {
  const save = useExp((x) => x.save);
  const [, tick] = useState(0);
  const last = useRef(0);
  useEffect(() => {
    const iv = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const pg = save.g[s.id];
  const full = !!pg && stagesOf(s).every((b) => pg.st & b);
  if (!full) return null;
  if (!game.creatures.some((c) => c.species === s.id && !c.hidden)) return null;
  let who: Peer | null = null;
  game.peers.forEach((p) => {
    if (!who && p.nb && !game.hidden.has(p.id) && Math.hypot(p.x - game.me.x, p.z - game.me.z) < 6) who = p;
  });
  if (!who) return null;
  const nick = (who as Peer).nick;
  return (
    <button
      className="ow-btn ow-btn-small tg-show"
      onClick={() => {
        const now = performance.now();
        if (now - last.current < 15000 || !game.act) return;
        last.current = now;
        game.act({ t: "sh", sp: s.id, to: nick });
        onShown(nick);
      }}
    >
      ✨ {t(tgUi(tp).showBeginner, { name: nick })}
    </button>
  );
}

// ------------------------------------------------------------------ cards
function TogetherCard(p: {
  tp: TogetherProps;
  exp: ExpeditionProps;
  t: T;
  game: Game;
  young: boolean;
  setSave: (f: (s: TSave) => TSave) => void;
  emit: (kind: "plant" | "water" | "museum" | "sticker", id: string) => void;
  startBlitz: () => void;
  speciesBy: Record<string, GuideSpecies>;
}) {
  const card = useTogether((s) => s.card);
  const close = () => {
    sound.sfx("pop", 0.5);
    closeCard();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.code === "Escape" && closeCard();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (!card) return null;
  return (
    <div className="ow-modal tg-modal" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className={"ow-card tg-card tg-k-" + card.kind} role="dialog" aria-modal="true">
        <button className="ow-round ow-close tg-x" aria-label={p.t(tgUi(p.tp).close)} onClick={close}>
          ✕
        </button>
        {card.kind === "bed" && <BedCard {...p} bed={card.bed} />}
        {card.kind === "display" && <DisplayCard {...p} owner={card.owner} />}
        {card.kind === "blitz" && <BlitzCard {...p} />}
        {card.kind === "blitzResult" && (
          <div className="tg-center">
            <div className="tg-big">{card.met ? "🍃" : "🔎"}</div>
            <h2>{p.t(tgUi(p.tp).blitzDone, { n: card.count })}</h2>
            <p className="tg-lead">{p.t(card.met ? tgUi(p.tp).blitzGoalMet : tgUi(p.tp).blitzThanks)}</p>
            <button className="ow-btn ow-btn-go" onClick={close}>
              ✓ {p.t(tgUi(p.tp).close)}
            </button>
          </div>
        )}
        {card.kind === "coop" && <CoopCard {...p} id={card.id} by={card.by} holder={card.holder} />}
        {card.kind === "badge" && <BadgeCard {...p} id={card.id} />}
      </div>
    </div>
  );
}

function PlantPic({ url, icon, dim }: { url: string; icon: string; dim?: boolean }) {
  const [bad, setBad] = useState(false);
  return url && !bad ? <img className={"tg-pic" + (dim ? " dim" : "")} src={url} alt="" draggable={false} onError={() => setBad(true)} /> : <span className={"tg-pic tg-emoji" + (dim ? " dim" : "")}>{icon}</span>;
}

function BedCard({ tp, exp, t, game, setSave, emit, speciesBy, bed }: Parameters<typeof TogetherCard>[0] & { bed: number }) {
  const ui = tgUi(tp);
  const plots = useTogether((s) => s.plots);
  const save = useTogether((s) => s.save);
  const [slot, setSlot] = useState<number | null>(null);
  const now = Date.now();
  const mine = plots.filter((x) => x.bed === bed);
  const at = (i: number) => mine.find((x) => x.slot === i) || null;
  const sel = slot != null ? at(slot) : null;
  const plantBy = (id: string) => tp.plants.find((x) => x.id === id);
  const keeper = bed === 0;
  void game;
  const plant = (id: string) => {
    if (slot == null) return;
    const st = useTogether.getState();
    const before = st.save.plots.filter((x) => now - x[3] < tp.rules.lifeHours * 3600000).length;
    const s2 = plantIn(st.save, st.plots, bed, slot, id, Date.now(), tp.rules);
    if (!s2) return;
    setSave(() => s2);
    emit("plant", bed + ":" + slot + ":" + id);
    sound.sfx("success", 0.7);
    useExp.getState().showToast("🌱", t(before >= tp.rules.plantsEach ? ui.replaceOldest : ui.planted));
  };
  const water = (pl: Plot) => {
    const st = useTogether.getState();
    if (!canWater(st.save, pl.bed, pl.slot, Date.now())) {
      useExp.getState().showToast("💧", t(ui.wateredSoon));
      return;
    }
    setSave((s) => waterAt(s, pl.bed, pl.slot, Date.now()));
    emit("water", pl.bed + ":" + pl.slot);
    sound.sfx("chime", 0.8);
    useExp.getState().showToast("💧", t(ui.watered));
  };
  const stageName = (n: number) => t([ui.sprout, ui.young, ui.flowering][n]);
  return (
    <>
      <div className="tg-head">
        <span className="tg-head-icon" aria-hidden>
          {keeper ? "🌼" : "🌱"}
        </span>
        <div>
          <h2>{t(ui.garden)}</h2>
          <div className="tg-sub">{t(keeper ? ui.keeperBed : ui.bedHint)}</div>
        </div>
      </div>
      <div className="tg-bed">
        {/* the back row first, as the bed is seen from the path */}
        {[1, 3, 5, 0, 2, 4].map((i) => {
          const pl = at(i);
          const pd = pl ? plantBy(pl.plant) : null;
          return (
            <button key={i} className={"tg-plot" + (slot === i ? " on" : "") + (pl ? " full" : "") + (pl && pl.mine ? " mine" : "")} onClick={() => setSlot(i)}>
              {pl && pd ? (
                <>
                  <PlantPic url={pd.iconUrl} icon={pd.icon} dim={pl.stage < 2} />
                  <span className="tg-plot-stage">
                    {PLANT_ICON[pl.stage]} {stageName(pl.stage)}
                  </span>
                </>
              ) : (
                <span className="tg-plot-empty">＋</span>
              )}
            </button>
          );
        })}
      </div>
      {slot != null && !sel && !keeper && (
        <div className="tg-seeds">
          <div className="tg-label">{t(ui.pickSeed)}</div>
          <div className="tg-seed-row">
            {tp.plants.map((pl) => (
              <button key={pl.id} className="tg-seed" onClick={() => plant(pl.id)}>
                <PlantPic url={pl.iconUrl} icon={pl.icon} />
                <span>{t(pl.name)}</span>
              </button>
            ))}
          </div>
          <div className="tg-note">{t(ui.plantsLeft, { n: tp.rules.plantsEach })}</div>
        </div>
      )}
      {sel && (
        <PlotInfo tp={tp} t={t} pl={sel} now={now} save={save} speciesBy={speciesBy} onWater={() => water(sel)} />
      )}
      {slot == null && <Chart tp={tp} t={t} exp={exp} save={save} speciesBy={speciesBy} />}
    </>
  );
}

function PlotInfo({ tp, t, pl, now, save, speciesBy, onWater }: { tp: TogetherProps; t: T; pl: Plot; now: number; save: TSave; speciesBy: Record<string, GuideSpecies>; onWater: () => void }) {
  const ui = tgUi(tp);
  const pd = tp.plants.find((x) => x.id === pl.plant);
  if (!pd) return null;
  const next = minutesToNext(pl, now, tp.rules);
  return (
    <div className="tg-plot-info">
      <div className="tg-row">
        <PlantPic url={pd.iconUrl} icon={pd.icon} />
        <div className="tg-grow">
          <div className="tg-name">{t(pd.name)}</div>
          <div className="tg-sub">{pl.keeper ? t(ui.keeperBed) : pl.mine ? t(ui.yourPlant) : t(ui.plantedBy, { name: pl.by })}</div>
          <div className="tg-sub">
            {PLANT_ICON[pl.stage]} {t([ui.sprout, ui.young, ui.flowering][pl.stage])}
            {next ? " · " + t(ui.noVisitors, { n: next }) : ""} {pl.waters ? " · 💧×" + pl.waters : ""}
          </div>
        </div>
        <button className="ow-btn tg-water" onClick={onWater}>
          💧 {t(ui.water)}
        </button>
      </div>
      <p className="tg-fact">{t(pd.fact)}</p>
      <div className="ex-source">{t(ui.source, { source: pd.source })}</div>
      <div className="tg-label">{t(ui.visitors)}</div>
      <div className="tg-visitors">
        {pd.visitors.map((v) => {
          const sp = speciesBy[v];
          const seen = save.pairs.indexOf(v + ">" + pd.id) >= 0;
          return sp ? (
            <span key={v} className={"tg-visitor" + (seen ? " seen" : "")} title={seen ? t(sp.name) : "?"}>
              <SpeciesPic s={sp} known={seen} />
              <span>{seen ? t(sp.name) : "?"}</span>
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

/** Who visits what: the pairings the explorer has seen for themself (a photo of a visitor drinking at that flower). */
function Chart({ tp, t, save, speciesBy }: { tp: TogetherProps; t: T; exp: ExpeditionProps; save: TSave; speciesBy: Record<string, GuideSpecies> }) {
  return (
    <div className="tg-chart">
      <div className="tg-label">📋 {t(tgUi(tp).chart)}</div>
      <div className="tg-note">{t(tgUi(tp).chartHint)}</div>
      {tp.plants.map((pd) => (
        <div key={pd.id} className="tg-chart-row">
          <span className="tg-chart-plant">
            <PlantPic url={pd.iconUrl} icon={pd.icon} /> {t(pd.name)}
          </span>
          <span className="tg-chart-cells">
            {pd.visitors.map((v) => {
              const sp = speciesBy[v];
              const seen = save.pairs.indexOf(v + ">" + pd.id) >= 0;
              return (
                <span key={v} className={"tg-cell" + (seen ? " seen" : "")} aria-label={seen && sp ? t(sp.name) : "?"}>
                  {seen && sp ? sp.icon : "?"}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function DisplayCard({ tp, exp, t, setSave, emit, speciesBy, owner }: Parameters<typeof TogetherCard>[0] & { owner: string }) {
  const ui = tgUi(tp);
  const displays = useTogether((s) => s.displays);
  const counts = useTogether((s) => s.stickers);
  const save = useTogether((s) => s.save);
  const expSave = useExp((s) => s.save);
  const [choose, setChoose] = useState(false);
  const d = displays.find((x) => x.owner === owner);
  if (!d) return null;
  const title = d.keeper ? t(ui.keeperDisplay) : d.mine ? t(ui.yourDisplay) : t(ui.display, { name: d.owner });
  const mineGiven = save.stk.find((e) => e[0] === d.owner);
  const best = (exp.species || []).filter((s) => expSave.g[s.id] && expSave.g[s.id].ph);
  const onShow = (sid: string) => save.museum.some((m) => m[0] === sid);
  const toggle = (sid: string) => {
    const ph = expSave.g[sid] && expSave.g[sid].ph;
    if (!ph) return;
    setSave((s) => {
      const has = s.museum.some((m) => m[0] === sid);
      const museum = has ? s.museum.filter((m) => m[0] !== sid) : s.museum.concat([[sid, ph.behaviour, ph.stars]]).slice(-tp.rules.museumEach);
      return { ...s, museum };
    });
    if (!onShow(sid)) emit("museum", sid);
    sound.sfx("pop", 0.6);
  };
  const doing = (sp: GuideSpecies | undefined, b: string) =>
    !sp ? "" : b === "feed" ? t(sp.feed) : b === "special" ? t(sp.special) : b === "move" ? t(exp.ui.doingMove) : b === "hide" ? t(exp.ui.doingHide) : t(exp.ui.doingIdle);
  return (
    <>
      <div className="tg-head">
        <span className="tg-head-icon" aria-hidden>
          {d.keeper ? "🧓" : "🖼️"}
        </span>
        <div>
          <h2>{title}</h2>
          <div className="tg-sub">{t(ui.museum)}</div>
        </div>
      </div>
      {!choose && (
        <div className="tg-photos">
          {d.photos.length ? (
            d.photos.map((p) => {
              const sp = speciesBy[p.species];
              return sp ? (
                <div key={p.species} className="tg-photo">
                  <SpeciesPic s={sp} known />
                  <div className="tg-name">{t(sp.name)}</div>
                  <div className="tg-stars">{"★".repeat(p.stars) + "☆".repeat(3 - p.stars)}</div>
                  <div className="tg-sub">{doing(sp, p.behaviour)}</div>
                </div>
              ) : null;
            })
          ) : (
            <p className="tg-lead">{t(ui.emptyDisplay)}</p>
          )}
        </div>
      )}
      {d.mine && (
        <div className="tg-choose">
          <button className="ow-btn ow-btn-small" onClick={() => setChoose(!choose)}>
            {choose ? "✓ " + t(ui.close) : "🖼️ " + t(ui.choosePhotos)}
          </button>
          {choose && (
            <>
              <div className="tg-note">{best.length ? t(ui.chooseHint, { n: tp.rules.museumEach }) : t(ui.noPhotos)}</div>
              <div className="tg-pick-grid">
                {best.map((s) => {
                  const ph = expSave.g[s.id].ph!;
                  const on = onShow(s.id);
                  return (
                    <button key={s.id} className={"tg-pick" + (on ? " on" : "")} onClick={() => toggle(s.id)} aria-pressed={on}>
                      <SpeciesPic s={s} known />
                      <span className="tg-stars">{"★".repeat(ph.stars)}</span>
                      {on && <span className="tg-onshow">✓ {t(ui.onShow)}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {d.mine && save.badges.length > 0 && (
        <>
          <div className="tg-label">🏅 {t(ui.badges)}</div>
          <div className="tg-badges">
            {tp.badges
              .filter((b) => save.badges.indexOf(b.id) >= 0)
              .map((b) => (
                <span key={b.id} className="tg-badge" title={t(b.about)}>
                  {b.icon} {t(b.name)}
                </span>
              ))}
          </div>
        </>
      )}
      <div className="tg-label">{t(d.mine ? ui.stickersGot : ui.leaveSticker)}</div>
      <div className="tg-stickers">
        {tp.stickers.map((s) => {
          const n = (counts[d.owner] || {})[s.id] || 0;
          const on = !!mineGiven && mineGiven[1] === s.id;
          return (
            <button
              key={s.id}
              className={"tg-sticker" + (on ? " on" : "")}
              disabled={d.mine}
              aria-label={t(s.name)}
              title={t(s.name)}
              onClick={() => {
                setSave((x) => giveSticker(x, d.owner === KEEPER_NICK ? KEEPER_NICK : d.owner, s.id));
                emit("sticker", d.owner + ":" + s.id);
                sound.sfx("chime", 0.8);
                useExp.getState().showToast("⭐", t(ui.stickerLeft));
              }}
            >
              {s.url ? <img src={s.url} alt="" draggable={false} /> : "⭐"}
              {n > 0 && <span className="tg-count">{n}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function BlitzCard({ tp, t, young, startBlitz, speciesBy }: Parameters<typeof TogetherCard>[0]) {
  const ui = tgUi(tp);
  const b = useTogether((s) => s.blitz);
  const save = useTogether((s) => s.save);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const live = b && Date.now() < blitzEnd(b, tp.rules);
  const joined = !!live && save.bb.ev === b!.id;
  const vars = { goal: tp.rules.blitzGoal, min: tp.rules.blitzMinutes };
  return (
    <>
      <div className="tg-head">
        <span className="tg-head-icon" aria-hidden>
          🔎
        </span>
        <div>
          <h2>{t(ui.blitz)}</h2>
          {live && <div className="tg-sub">{t(ui.blitzTeam, { n: Math.max(1, b!.team.length) })}</div>}
        </div>
      </div>
      <p className="tg-lead">{t(young ? ui.blitzIntroEasy : ui.blitzIntro, vars)}</p>
      {live && (
        <div className="tg-blitz-live">
          <div className="tg-meter" role="progressbar" aria-valuemin={0} aria-valuemax={tp.rules.blitzGoal} aria-valuenow={b!.found.length}>
            <i style={{ width: Math.min(100, (b!.found.length / tp.rules.blitzGoal) * 100) + "%" }} />
            <span>{t(ui.blitzCount, { n: b!.found.length, goal: tp.rules.blitzGoal })}</span>
          </div>
          {joined && <div className="tg-clock-big">⏳ {fmtClock(blitzEnd(b!, tp.rules) - Date.now())}</div>}
          <div className="tg-found">
            {b!.found.map((id) => (speciesBy[id] ? <span key={id} title={t(speciesBy[id].name)}>{speciesBy[id].icon}</span> : null))}
          </div>
        </div>
      )}
      {!joined && (
        <button className="ow-btn ow-btn-go" onClick={startBlitz}>
          🔎 {t(live ? ui.blitzJoin : ui.blitzStart)}
        </button>
      )}
      {joined && <p className="tg-note">{t(ui.blitzHow)}</p>}
      <div className="tg-fact-box">
        <div className="tg-label">📚 {t(ui.blitzRealFact)}</div>
        <p className="tg-fact">{t(young ? tp.blitzFactEasy : tp.blitzFact)}</p>
        <div className="ex-source">{t(ui.source, { source: tp.blitzSource })}</div>
      </div>
    </>
  );
}

function CoopCard({ tp, t, speciesBy, id, by, holder }: Parameters<typeof TogetherCard>[0] & { id: string; by: string; holder: boolean }) {
  const c = tp.coop.find((x) => x.id === id);
  if (!c) return null;
  const sp = speciesBy[c.species];
  return (
    <div className="tg-center">
      {sp && <SpeciesPic s={sp} known big />}
      <h2>🤝 {t(tgUi(tp).coopDone)}</h2>
      {by && holder && <p className="tg-lead">{t(tgUi(tp).coopThanks, { name: by })}</p>}
      {by && !holder && <p className="tg-lead">🤝 {by}</p>}
      <p className="tg-fact">{t(c.fact)}</p>
      <div className="ex-source">{t(tgUi(tp).source, { source: c.source })}</div>
      <button className="ow-btn ow-btn-go" onClick={closeCard}>
        ✓ {t(tgUi(tp).close)}
      </button>
    </div>
  );
}

function SpinBadge({ url, node }: { url: string; node: string }) {
  const gltf = useModel(url);
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(node);
    const o = src ? src.clone(true) : new THREE.Group();
    o.position.set(0, 0, 0);
    return o;
  }, [gltf, node]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 1.4) * 0.6;
  });
  return (
    <group ref={ref} position={[0, -0.075, 0]}>
      <primitive object={obj} />
    </group>
  );
}

function BadgeCard({ tp, t, id }: Parameters<typeof TogetherCard>[0] & { id: string }) {
  const b = tp.badges.find((x) => x.id === id);
  if (!b) return null;
  return (
    <div className="tg-center">
      <div className="tg-label">🏅 {t(tgUi(tp).badge)}</div>
      <div className="tg-badge-view">
        {tp.models.badges ? (
          <Canvas camera={{ position: [0, 0, 0.32], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[1, 2, 3]} intensity={2} />
            <React.Suspense fallback={null}>
              <SpinBadge url={tp.models.badges} node={b.node} />
            </React.Suspense>
          </Canvas>
        ) : (
          <span className="tg-big">{b.icon}</span>
        )}
      </div>
      <h2>
        {b.icon} {t(b.name)}
      </h2>
      <p className="tg-lead">{t(b.about)}</p>
      <button className="ow-btn ow-btn-go" onClick={closeCard}>
        ✓ {t(tgUi(tp).close)}
      </button>
    </div>
  );
}

export { BEDS, STAGE };
