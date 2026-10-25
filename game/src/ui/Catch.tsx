// Catch and release, measure and weigh. The butterfly net: walk slowly up to an insect (a ring shows it
// is in reach) and sweep the net gently across (drag the net along its arc, or hold Space): too fast and it
// flies off, "try again, slowly" — no fail state. The jar: count legs and body parts (insect or not?),
// pull the tape from tail to head (the reading is the real length), balance the pan scale with gram weights
// (the real mass), then let it go where it was found. Keeping it is impossible: the jar is never saved.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { GuideSpecies, LensFeature } from "../block";
import { useExp } from "../game/expedition";
import { STAGE } from "../game/quests";
import { sound } from "../audio";
import { needsLogin, useModel } from "../scene/assets";
import { SpeciesPic } from "./FieldKit";
import type { ExpeditionApi } from "./Expedition";

/** How close the net reaches (metres from the explorer). */
export const NET_REACH = 2.4;
/** A sweep quicker than this scares the insect away. */
const SWEEP_MIN_MS = 380;
/** Let it go within this distance of where it was caught. */
const RELEASE_R = 4;

const tmp = new THREE.Vector3();

function nearestCatchable(api: ExpeditionApi, within: number) {
  const { game } = api;
  let best: { key: string; species: string; d: number; x: number; z: number } | null = null;
  for (const c of game.creatures) {
    if (!c.catchable || c.hidden || c.behaviour === "flee" || c.behaviour === "hide") continue;
    c.obj.getWorldPosition(tmp);
    const d = Math.hypot(tmp.x - game.me.x, tmp.z - game.me.z);
    if (d <= within && (!best || d < best.d)) best = { key: c.key, species: c.species, d, x: tmp.x, z: tmp.z };
  }
  return best;
}

function fmtLen(mm: number, lang: string): string {
  const sep = lang === "fr" ? "," : ".";
  if (mm < 10) return (Math.round(mm * 10) / 10).toString().replace(".", sep) + " mm";
  return (Math.round(mm) / 10).toString().replace(".", sep) + " cm";
}

function fmtG(g: number, lang: string): string {
  return (Math.round(g * 10) / 10).toString().replace(".", lang === "fr" ? "," : ".") + " g";
}

function answer(api: ExpeditionApi, questionId: string, question: string, correct: boolean, attempt: number) {
  try {
    api.mexty.progress.answer({ questionId, question, correct, attempt });
  } catch {
    /* outside EdVerse */
  }
}

// ------------------------------------------------------------------ the net
/** The catch itself: a gentle, complete sweep with an insect in reach puts it in the jar. */
export function trySweep(api: ExpeditionApi, ms: number, full: boolean): boolean {
  const { t, exp } = api;
  const ui = exp.ui;
  const st = useExp.getState();
  useExp.setState({ sweepAt: performance.now() });
  if (st.jar) {
    st.showToast("🫙", t(ui.jarFull));
    return false;
  }
  const c = nearestCatchable(api, NET_REACH);
  if (!c) {
    st.showToast("🥅", t(ui.sweepNone));
    return false;
  }
  if (!full) {
    st.showToast("🥅", t(ui.sweepMiss));
    return false;
  }
  if (ms < SWEEP_MIN_MS) {
    st.showToast("💨", t(ui.sweepFast));
    sound.sfx("pop", 0.5);
    return false;
  }
  st.seen(c.species);
  useExp.setState({ jar: { key: c.key, species: c.species, zone: api.zone, x: c.x, z: c.z, looked: false, measured: false, weighed: false }, jarTab: "look", mode: null });
  sound.sfx("success", 0.8);
  st.showToast("🫙", t(ui.caught));
  return true;
}

/** The net is out: the reach ring on the nearest insect and the sweep pad (drag along the arc, or hold Space). */
export function NetView({ api }: { api: ExpeditionApi }) {
  const { t, exp, game } = api;
  const ui = exp.ui;
  const [ring, setRing] = useState<{ x: number; y: number; r: number; ok: boolean } | null>(null);
  const [k, setK] = useState(0);
  const drag = useRef<{ id: number; start: number; moved: number } | null>(null);
  const pad = useRef<HTMLDivElement>(null);
  const hold = useRef<{ start: number; raf: number } | null>(null);
  useEffect(() => {
    game.tiptoe = true;
    return () => {
      game.tiptoe = false;
      useExp.setState({ sweepK: -1 });
    };
  }, [game]);
  // the nearest catchable creature, ringed (green when the net reaches it)
  useEffect(() => {
    const iv = window.setInterval(() => {
      const c = nearestCatchable(api, 7);
      const cam = game.view.camera;
      if (!c || !cam) return setRing(null);
      const lc = game.creatures.find((x) => x.key === c.key);
      if (!lc) return setRing(null);
      lc.obj.getWorldPosition(tmp);
      tmp.y += lc.cy;
      const depth = tmp.clone().applyMatrix4(cam.matrixWorldInverse).z;
      const p = tmp.clone().project(cam);
      if (depth > -0.1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return setRing(null);
      const r = Math.max(22, (lc.radius / (-depth * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) * (game.view.height / 2) * 1.4);
      setRing({ x: ((p.x + 1) / 2) * game.view.width, y: ((1 - p.y) / 2) * game.view.height, r, ok: c.d <= NET_REACH });
    }, 120);
    return () => window.clearInterval(iv);
  }, [api, game]);
  const setSweep = (v: number) => {
    setK(v);
    useExp.setState({ sweepK: v });
  };
  const finish = (ms: number, full: boolean) => {
    trySweep(api, ms, full);
    window.setTimeout(() => setSweep(0), 250);
  };
  // the keyboard: hold Space, the net sweeps across at a gentle pace, let go at the end
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        useExp.getState().setMode(null);
        return;
      }
      if (e.code !== "Space" || e.repeat || hold.current) return;
      e.preventDefault();
      const start = performance.now();
      const tick = () => {
        const v = Math.min(1, (performance.now() - start) / 900);
        setSweep(v);
        if (hold.current) hold.current.raf = requestAnimationFrame(tick);
      };
      hold.current = { start, raf: requestAnimationFrame(tick) };
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !hold.current) return;
      cancelAnimationFrame(hold.current.raf);
      const ms = performance.now() - hold.current.start;
      hold.current = null;
      finish(ms, ms >= 880);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (hold.current) cancelAnimationFrame(hold.current.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const at = (clientX: number) => {
    const el = pad.current;
    if (!el) return 0;
    const b = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - b.left - 28) / Math.max(1, b.width - 56)));
  };
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, start: performance.now(), moved: 0 };
    setSweep(at(e.clientX));
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const v = at(e.clientX);
    if (v > 0.06 && !d.moved) d.start = performance.now();
    d.moved = Math.max(d.moved, v);
    setSweep(v);
    if (v >= 0.96) {
      drag.current = null;
      finish(performance.now() - d.start, true);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved > 0.25) finish(performance.now() - d.start, false);
    else setSweep(0);
  };
  // the net's handle on its arc
  const ang = Math.PI * (1 - k);
  const hx = 50 + Math.cos(ang) * 40;
  const hy = 52 - Math.sin(ang) * 34;
  return (
    <div className="ct-net" aria-label={t(ui.net)}>
      {ring && <div className={"ct-ring" + (ring.ok ? " ok" : "")} style={{ left: ring.x, top: ring.y, width: ring.r * 2, height: ring.r * 2 }} aria-hidden />}
      <div className="ct-pad ow-card" ref={pad} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} role="slider" aria-label={t(ui.sweep)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(k * 100)}>
        <svg viewBox="0 0 100 60" aria-hidden>
          <path d="M10 52 A40 34 0 0 1 90 52" className="ct-arc" />
          <path d={`M10 52 A40 34 0 0 1 ${hx.toFixed(1)} ${hy.toFixed(1)}`} className="ct-arc on" />
          <g transform={`translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${((k - 0.5) * 70).toFixed(0)})`}>
            <line x1="0" y1="0" x2="0" y2="14" className="ct-handle" />
            <ellipse cx="0" cy="-5" rx="9" ry="7" className="ct-hoop" />
          </g>
        </svg>
        <div className="ct-pad-text">
          <b>🥅 {t(ui.sweep)}</b>
          <span>{t(ui.netHint)}</span>
          <small>
            {t(ui.sweepHint)} {t(ui.sweepKeys)}
          </small>
        </div>
        <button
          className="ow-round ow-close ct-pad-close"
          aria-label={t(ui.close)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => useExp.getState().setMode(null)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the jar card
function Checks({ api, sp, onRight }: { api: ExpeditionApi; sp: GuideSpecies; onRight: () => void }) {
  const { t, exp, young } = api;
  const ui = exp.ui;
  const feats = useMemo(() => {
    const m: Record<string, LensFeature> = {};
    for (const f of exp.lensFeatures || []) m[f.id] = f;
    return m;
  }, [exp.lensFeatures]);
  const [vals, setVals] = useState<Record<string, number | null>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const checks = sp.lens || [];
  const ready = checks.every((c) => vals[c.feature] != null);
  const check = () => {
    const bad = checks.filter((c) => vals[c.feature] !== c.value).map((c) => c.feature);
    const attempt = tries + 1;
    setTries(attempt);
    answer(api, "jar:" + sp.id, t(ui.jarLook) + " — " + t(sp.name), bad.length === 0, attempt);
    if (bad.length) {
      setWrong(bad);
      sound.sfx("pop", 0.5);
    } else {
      setWrong([]);
      sound.sfx("success", 0.9);
      onRight();
    }
  };
  return (
    <>
      <div className="ex-lens-checks">
        {checks.map((c) => {
          const f = feats[c.feature];
          if (!f) return null;
          const v = vals[c.feature];
          const isWrong = wrong.indexOf(c.feature) >= 0;
          return (
            <div key={c.feature} className={"ex-check" + (isWrong ? " wrong" : "")}>
              <div className="ex-check-q">
                <span aria-hidden>{f.icon}</span> {t(f.question)}
              </div>
              {f.kind === "count" ? (
                <div className="ex-count">
                  <button className="ow-round ex-small" disabled={!v} aria-label={t(ui.undo)} onClick={() => setVals({ ...vals, [c.feature]: Math.max(0, (v || 0) - 1) })}>
                    ➖
                  </button>
                  <div className="ex-tally" aria-live="polite">
                    <b>{v == null ? "?" : v}</b>
                    <span className="ex-dots" aria-hidden>
                      {Array.from({ length: Math.min(v || 0, f.max) }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                  </div>
                  <button className="ow-round ex-small" disabled={(v || 0) >= f.max} aria-label="+" onClick={() => setVals({ ...vals, [c.feature]: Math.min(f.max, (v || 0) + 1) })}>
                    ➕
                  </button>
                </div>
              ) : (
                <div className="ow-seg ex-yesno">
                  <button className={v === 1 ? "on" : ""} onClick={() => setVals({ ...vals, [c.feature]: 1 })}>
                    👍 {t(ui.yes)}
                  </button>
                  <button className={v === 0 ? "on" : ""} onClick={() => setVals({ ...vals, [c.feature]: 0 })}>
                    👎 {t(ui.no)}
                  </button>
                </div>
              )}
              {isWrong && <div className="ex-kind">{t(f.tip)}</div>}
              {f.kind === "count" && v == null && !young && <div className="ex-small-text">{t(ui.lensCountHint)}</div>}
            </div>
          );
        })}
      </div>
      {wrong.length > 0 && <div className="ex-kind center">{t(ui.lensWrong)}</div>}
      <button className="ow-btn ow-btn-go" disabled={!ready} onClick={check}>
        🔍 {t(ui.lensCheck)}
      </button>
    </>
  );
}

/** Its picture laid along a real-size ruler: drag the tape's end from the tail to the head. */
function Measure({ api, sp, onRight }: { api: ExpeditionApi; sp: GuideSpecies; onRight: () => void }) {
  const { t, exp } = api;
  const ui = exp.ui;
  const lang = useLang(api);
  const m = sp.measure!;
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  const [hx, setHx] = useState(0);
  const [msg, setMsg] = useState<"" | "short" | "long" | "right">("");
  const [tries, setTries] = useState(0);
  const dragging = useRef<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setW(Math.max(260, el.clientWidth));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ax = sp.iconAxis && sp.iconAxis.length === 4 ? sp.iconAxis : [0.15, 0.5, 0.85, 0.5];
  const span = Math.max(0.05, Math.hypot(ax[2] - ax[0], ax[3] - ax[1]));
  const ang = Math.atan2(ax[3] - ax[1], ax[2] - ax[0]);
  const PAD = 34;
  const Lp = W * 0.6; // body length on screen
  const S = Lp / span; // picture size
  const pxPerMm = Lp / m.lengthMm;
  // the turned picture's top and bottom around the body line, so all of it shows on the board
  let minY = 0;
  let maxY = 0;
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const dx = (cx - ax[0]) * S;
    const dy = (cy - ax[1]) * S;
    const y = dx * Math.sin(-ang) + dy * Math.cos(-ang);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const mid = Math.max(70, -minY * 0.92);
  const H = Math.min(420, Math.max(220, mid + maxY * 0.8 + 40));
  const reading = Math.max(0, hx / pxPerMm);
  const mag = Math.max(1, Math.round(pxPerMm / 3.78));
  useEffect(() => {
    setHx(0);
    setMsg("");
  }, [sp.id]);
  // ruler ticks: every mm when there is room, labels every cm (every mm for the tiniest)
  const step = pxPerMm >= 3 ? 1 : 5;
  const label = m.lengthMm < 8 ? 1 : 10;
  const maxMm = Math.floor((W - PAD - 8) / pxPerMm);
  const ticks: React.ReactNode[] = [];
  for (let mm = 0; mm <= maxMm; mm += step) {
    const x = PAD + mm * pxPerMm;
    const big = mm % label === 0;
    ticks.push(<line key={mm} x1={x} x2={x} y1={H - 30} y2={H - 30 + (big ? 16 : mm % 5 === 0 ? 10 : 6)} className="ct-tick" />);
    if (big) ticks.push(<text key={"t" + mm} x={x} y={H - 2} className="ct-tick-text">{label === 1 ? mm : mm / 10}</text>);
  }
  const check = (x: number) => {
    const r = x / pxPerMm;
    const err = (r - m.lengthMm) / m.lengthMm;
    const ok = Math.abs(err) <= 0.12;
    const attempt = tries + 1;
    setTries(attempt);
    answer(api, "measure:" + sp.id, t(ui.measureTitle) + " — " + t(sp.name), ok, attempt);
    if (ok) {
      setHx(m.lengthMm * pxPerMm);
      setMsg("right");
      sound.sfx("success", 0.8);
      onRight();
    } else {
      setMsg(err < 0 ? "short" : "long");
      sound.sfx("pop", 0.5);
    }
  };
  const fromEvent = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(W - PAD - 6, e.clientX - b.left - PAD));
  };
  const what = t(m.what);
  return (
    <div className="ct-measure">
      <div className="ct-board" ref={box} style={{ height: H }}>
        <div
          className="ct-body"
          style={{
            width: S,
            height: S,
            transformOrigin: `${ax[0] * S}px ${ax[1] * S}px`,
            transform: `translate(${PAD - ax[0] * S}px, ${mid - ax[1] * S}px) rotate(${-ang}rad)`,
          }}
          aria-hidden
        >
          <SpeciesPic s={sp} known big />
        </div>
        <svg className="ct-ruler" width={W} height={H} aria-hidden>
          <rect x={PAD - 6} y={H - 34} width={W - PAD} height={34} rx={5} className="ct-ruler-wood" />
          {ticks}
          <line x1={PAD} x2={PAD} y1={mid - 50} y2={H - 30} className="ct-zero" />
          <rect x={PAD} y={mid + 34} width={Math.max(0, hx)} height={12} rx={3} className="ct-blade" />
          {Array.from({ length: Math.floor(hx / pxPerMm / (label === 1 ? 1 : 10)) + 1 }, (_, i) => (
            <line key={i} x1={PAD + i * (label === 1 ? 1 : 10) * pxPerMm} x2={PAD + i * (label === 1 ? 1 : 10) * pxPerMm} y1={mid + 34} y2={mid + 42} className="ct-blade-tick" />
          ))}
        </svg>
        <img className="ct-case" src={(exp.tools.find((x) => x.id === "tape") || { iconUrl: "" }).iconUrl || undefined} alt="" draggable={false} style={{ left: PAD - 40, top: mid + 18 }} crossOrigin="use-credentials" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
        <button
          className={"ct-hook" + (msg === "right" ? " ok" : "")}
          style={{ left: PAD + hx - 22, top: mid + 18 }}
          aria-label={t(ui.measureTitle)}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragging.current = e.pointerId;
            if (msg) setMsg("");
          }}
          onPointerMove={(e) => dragging.current === e.pointerId && setHx(fromEvent(e))}
          onPointerUp={(e) => {
            if (dragging.current !== e.pointerId) return;
            dragging.current = null;
            check(fromEvent(e));
          }}
          onKeyDown={(e) => {
            const d = Math.max(0.5, m.lengthMm * 0.04) * pxPerMm;
            if (e.code === "ArrowRight") setHx((x) => Math.min(W - PAD - 6, x + d));
            else if (e.code === "ArrowLeft") setHx((x) => Math.max(0, x - d));
            else if (e.code === "Enter" || e.code === "Space") check(hx);
            else return;
            e.preventDefault();
            if (msg && e.code.indexOf("Arrow") === 0) setMsg("");
          }}
        >
          ▶
        </button>
        <div className="ct-reading" aria-live="polite">
          {msg === "right" ? t(ui.measureRight, { value: fmtLen(m.lengthMm, lang) }) : fmtLen(reading, lang)}
        </div>
      </div>
      <div className="ex-small-text center">🔎 {t(ui.magnified, { n: mag })}</div>
      {msg === "" && <p className="ex-text">{t(ui.measureHint, { what })}</p>}
      {msg === "short" && <div className="ex-kind">{t(ui.measureShort)}</div>}
      {msg === "long" && <div className="ex-kind">{t(ui.measureLong, { what })}</div>}
      {msg === "right" && (
        <div className="ex-good">
          <b>📏 {t(m.lengthText)}</b>
          <div className="ex-source">{t(ui.source, { source: m.source })}</div>
        </div>
      )}
    </div>
  );
}

function useLang(api: ExpeditionApi): string {
  // the language the texts are shown in (the same pick as t())
  return api.t({ en: "en", fr: "fr" });
}

// ------------------------------------------------------------------ the pan scale (a small 3D bench)
const WEIGHTS = [5, 1, 0.1];

function IconSprite({ url, y }: { url: string; y: number }) {
  const tex = useLoader(THREE.TextureLoader, url, (l) => l.setCrossOrigin(needsLogin(url) ? "use-credentials" : "anonymous"));
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return (
    <sprite position={[0, y, 0]} scale={[0.16, 0.16, 1]}>
      <spriteMaterial map={tex} transparent />
    </sprite>
  );
}

function ScaleModel({ url, left, right, iconUrl }: { url: string; left: number; right: number[]; iconUrl: string }) {
  const gltf = useModel(url);
  const { obj, beam, pointer, panL, panR, brass } = useMemo(() => {
    const obj = gltf.scene.clone(true);
    let brass: THREE.Material | null = null;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === "scale_brass") brass = m.material as THREE.Material;
    });
    return { obj, beam: obj.getObjectByName("scale_beam"), pointer: obj.getObjectByName("scale_pointer"), panL: obj.getObjectByName("scale_pan_L"), panR: obj.getObjectByName("scale_pan_R"), brass: brass as THREE.Material | null };
  }, [gltf]);
  const base = useRef({ l: panL ? panL.position.y : 0.328, r: panR ? panR.position.y : 0.328 });
  const ang = useRef(0);
  const vel = useRef(0);
  const leftG = useRef<THREE.Group>(null);
  const rightG = useRef<THREE.Group>(null);
  const R = right.reduce((a, b) => a + b, 0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const diff = left - R;
    const tol = 0.05;
    const want = Math.abs(diff) <= tol ? 0 : Math.max(-0.28, Math.min(0.28, (diff / Math.max(left, R, 0.1)) * 0.5));
    // a damped swing: the beam overshoots a little and settles
    vel.current += (want - ang.current) * 40 * dt;
    vel.current *= Math.exp(-dt * 5);
    ang.current += vel.current * dt;
    const a = ang.current;
    if (beam) beam.rotation.z = a;
    if (pointer) pointer.rotation.z = a;
    const dy = 0.205 * Math.sin(a);
    if (panL) panL.position.y = base.current.l - dy;
    if (panR) panR.position.y = base.current.r + dy;
    if (leftG.current) leftG.current.position.set(-0.205, base.current.l - dy - 0.2, 0);
    if (rightG.current) rightG.current.position.set(0.205, base.current.r + dy - 0.2, 0);
  });
  let h = 0.012;
  return (
    <group>
      <primitive object={obj} />
      <group ref={leftG}>
        {left > 0 && iconUrl && (
          <React.Suspense fallback={null}>
            <IconSprite url={iconUrl} y={0.075} />
          </React.Suspense>
        )}
      </group>
      <group ref={rightG}>
        {right.map((w, i) => {
          const r = w >= 5 ? 0.045 : w >= 1 ? 0.032 : 0.02;
          const th = w >= 5 ? 0.026 : w >= 1 ? 0.018 : 0.01;
          const y = h + th / 2;
          h += th + 0.002;
          const col = i % 3;
          return (
            <mesh key={i} position={[(col - 1) * 0.004, y, 0]} material={brass || undefined}>
              <cylinderGeometry args={[r, r * 1.04, th, 24]} />
              {!brass && <meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.35} />}
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Weigh({ api, sp, onRight }: { api: ExpeditionApi; sp: GuideSpecies; onRight: () => void }) {
  const { t, exp } = api;
  const ui = exp.ui;
  const lang = useLang(api);
  const m = sp.measure!;
  const scale = exp.tools.find((x) => x.id === "scale");
  const [right, setRight] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const tries = useRef(0);
  const done1 = useRef(onRight);
  done1.current = onRight;
  const R = Math.round(right.reduce((a, b) => a + b, 0) * 10) / 10;
  // the pans weigh the same: the beam swings level (the bench animates it), then the reading is kept
  const level = right.length > 0 && Math.abs(R - m.massG) <= 0.05;
  useEffect(() => {
    if (!level || done || !right.length) return;
    const id = window.setTimeout(() => {
      tries.current++;
      answer(api, "weigh:" + sp.id, t(ui.weighTitle) + " — " + t(sp.name), tries.current === 1, tries.current);
      setDone(true);
      sound.sfx("success", 0.8);
      done1.current();
    }, 1100);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, done, R]);
  const add = (w: number) => {
    if (done) return;
    if (right.length >= 18) return;
    setRight(right.concat(w));
    sound.sfx("pop", 0.4);
  };
  if (!m.massG)
    return (
      <div className="ct-weigh">
        <div className="ex-kind">⚖️ {t(ui.weighNone)}</div>
      </div>
    );
  const heavy = R > m.massG + 0.05;
  return (
    <div className="ct-weigh">
      <div className="ct-bench">
        {scale && scale.modelUrl ? (
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.42, 0.78], fov: 38 }} gl={{ antialias: true, preserveDrawingBuffer: /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) }} onCreated={({ camera }) => camera.lookAt(0, 0.27, 0)}>
            <hemisphereLight args={["#fff6e0", "#8a6a48", 1.2]} />
            <directionalLight position={[1, 2, 1.5]} intensity={1.6} />
            <React.Suspense fallback={null}>
              <ScaleModel url={scale.modelUrl} left={m.massG} right={right} iconUrl={sp.iconUrl} />
            </React.Suspense>
          </Canvas>
        ) : null}
        <div className="ct-bench-r">{fmtG(R, lang)}</div>
      </div>
      <div className="ct-weights">
        {WEIGHTS.map((w) => (
          <button key={w} className="ct-weight" disabled={done} onClick={() => add(w)}>
            + {fmtG(w, lang)}
          </button>
        ))}
        <button className="ow-round ex-small" disabled={done || !right.length} aria-label={t(ui.undo)} onClick={() => setRight(right.slice(0, -1))}>
          ↩
        </button>
        <button className="ow-btn ow-btn-small" disabled={done || !right.length} onClick={() => setRight([])}>
          {t(ui.weighClear)}
        </button>
      </div>
      {done ? (
        <div className="ex-good">
          <b>⚖️ {t(ui.weighRight, { value: fmtG(m.massG, lang) })}</b> <span>({t(m.massText)})</span>
          <div className="ex-source">{t(ui.source, { source: m.source })}</div>
        </div>
      ) : right.length === 0 ? (
        <p className="ex-text">{t(ui.weighHint)}</p>
      ) : level ? null : (
        <div className="ex-kind">{t(heavy ? ui.weighHeavy : ui.weighLight)}</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the card
export function JarCard({ api }: { api: ExpeditionApi }) {
  const { t, exp, game, young } = api;
  const ui = exp.ui;
  const jar = useExp((s) => s.jar);
  const tab = useExp((s) => s.jarTab);
  const save = useExp((s) => s.save);
  const sp = jar ? api.species(jar.species) : undefined;
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(iv);
  }, []);
  if (!jar || !sp || !tab) return null;
  const has = (id: string) => save.tools.indexOf(id) >= 0;
  const close = () => useExp.setState({ jarTab: null });
  const setTab = (x: "look" | "measure" | "weigh") => {
    sound.sfx("pop", 0.4);
    useExp.setState({ jarTab: x });
  };
  const update = (p: Partial<NonNullable<typeof jar>>) => {
    const j = useExp.getState().jar;
    if (j) useExp.setState({ jar: { ...j, ...p } });
  };
  const insect = (sp.lens || []).some((c) => c.feature === "legs" && c.value === 6) || (sp.lens || []).some((c) => c.feature === "trueLegs");
  const d = Math.hypot(game.me.x - jar.x, game.me.z - jar.z);
  const home = jar.zone === api.zone && d <= RELEASE_R;
  const release = () => {
    if (!jar.looked) return;
    if (!home) {
      useExp.getState().showToast("🧭", t(ui.releaseFar, { m: Math.round(d) }));
      sound.sfx("pop", 0.5);
      return;
    }
    api.addStage(sp.id, STAGE.released);
    api.emit({ kind: "release", id: sp.id, zone: api.zone });
    useExp.setState({ jar: null, jarTab: null, releasedAt: performance.now() });
    useExp.getState().showToast(sp.icon, t(ui.released));
    sound.sfx("chime", 0.8);
  };
  const facts = sp.facts || [];
  return (
    <div className="ow-modal ex-modal" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ow-card ct-jar" role="dialog" aria-modal="true" aria-label={t(ui.jar)}>
        <div className="ex-lens-head">
          <div className="ex-lens-title">
            🫙 {t(sp.name)}
          </div>
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={close}>
            ✕
          </button>
        </div>
        <div className="ow-seg ct-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "look"} className={tab === "look" ? "on" : ""} onClick={() => setTab("look")}>
            🔍 {t(ui.jarLook)} {jar.looked ? "✓" : ""}
          </button>
          {has("tape") && sp.measure && (
            <button role="tab" aria-selected={tab === "measure"} className={tab === "measure" ? "on" : ""} onClick={() => setTab("measure")}>
              📏 {t(ui.measureTitle)} {jar.measured ? "✓" : ""}
            </button>
          )}
          {has("scale") && sp.measure && (
            <button role="tab" aria-selected={tab === "weigh"} className={tab === "weigh" ? "on" : ""} onClick={() => setTab("weigh")}>
              ⚖️ {t(ui.weighTitle)} {jar.weighed ? "✓" : ""}
            </button>
          )}
        </div>
        <div className="ct-body-wrap">
          {tab === "look" && (
            <div className="ct-look">
              <div className="ct-jarpic">
                <SpeciesPic s={sp} known big />
              </div>
              {jar.looked ? (
                <div className="ex-good">
                  <b>✅ {insect ? t(ui.isInsect) : t(ui.notInsect, { group: t(sp.group) })}</b>
                  {facts[2] && <p>{t(young ? facts[2].easy : facts[2].text)}</p>}
                </div>
              ) : (
                <div className="ct-look-checks">
                  <p className="ex-small-text">{t(ui.jarCount)}</p>
                  <Checks
                    api={api}
                    sp={sp}
                    onRight={() => {
                      api.addStage(sp.id, STAGE.seen);
                      api.addStage(sp.id, STAGE.id);
                      api.emit({ kind: "identify", id: sp.id, zone: api.zone });
                      update({ looked: true });
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {tab === "measure" && sp.measure && (
            <Measure
              api={api}
              sp={sp}
              onRight={() => {
                api.addStage(sp.id, STAGE.measured);
                api.emit({ kind: "measure", id: sp.id, zone: api.zone });
                update({ measured: true });
              }}
            />
          )}
          {tab === "weigh" && sp.measure && (
            <Weigh
              api={api}
              sp={sp}
              onRight={() => {
                const st = useExp.getState();
                const pg = st.save.g[sp.id] || { st: 0 };
                st.setSave({ ...st.save, g: { ...st.save.g, [sp.id]: { ...pg, st: pg.st | STAGE.weighed } } });
                api.emit({ kind: "weigh", id: sp.id, zone: api.zone });
                update({ weighed: true });
              }}
            />
          )}
        </div>
        <div className="ct-release">
          <button className="ow-btn ow-btn-go" disabled={!jar.looked} onClick={release}>
            🍃 {jar.looked ? t(ui.release) : t(ui.lookFirst)}
          </button>
          <div className={"ex-small-text center" + (home ? "" : " ct-far")}>{!jar.looked ? t(ui.releaseFirst) : home ? t(ui.releaseHere) : t(ui.releaseFar, { m: Math.round(d) })}</div>
        </div>
      </div>
    </div>
  );
}
