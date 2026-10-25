// The field kit: the Field Camera's viewfinder (frame, focus ring, zoom, shutter) and its photo card, the
// Field Guide book (a page per species, four stages, one true fact each), and the hand lens (the explorer
// counts and checks features themself; a right observation identifies the creature).
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { GuideSpecies, T } from "../block";
import type { Game, LiveCreature } from "../game/state";
import { useExp } from "../game/expedition";
import { guideScore, PhotoCheck, photoStars, PHOTO_RULES, PhotoRecord, STAGE, STAGES } from "../game/quests";
import { sound } from "../audio";
import type { ExpeditionApi } from "./Expedition";

const FOV_WIDE = 50;
const FOV_TELE = 14;

// ------------------------------------------------------------------ what the camera sees
interface Seen {
  c: LiveCreature;
  check: PhotoCheck;
  /** Screen position (px) and radius (px). */
  sx: number;
  sy: number;
  sr: number;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** Every creature whose centre is in the frame, best framed first. */
export function inFrame(game: Game): Seen[] {
  const cam = game.view.camera;
  if (!cam) return [];
  const w = game.view.width;
  const h = game.view.height;
  const short = Math.min(w, h);
  const out: Seen[] = [];
  cam.updateMatrixWorld();
  for (const c of game.creatures) {
    const o = c.obj;
    o.getWorldPosition(tmp);
    tmp.y += c.cy;
    tmp2.copy(tmp).applyMatrix4(cam.matrixWorldInverse);
    const depth = -tmp2.z;
    if (depth <= 0.1) continue;
    const ndc = tmp.clone().project(cam);
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue;
    const sx = ((ndc.x + 1) / 2) * w;
    const sy = ((1 - ndc.y) / 2) * h;
    const sr = (c.radius / (depth * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))) * (h / 2);
    const fill = (2 * sr) / short;
    if (fill < PHOTO_RULES.inFrameFill) continue;
    const offCentre = Math.hypot(sx - w / 2, sy - h / 2) / (short / 2);
    o.getWorldPosition(tmp);
    const distance = Math.hypot(tmp.x - game.me.x, tmp.z - game.me.z);
    // too far away to be a photo of it (it would be lost among the leaves)
    if (distance > PHOTO_RULES.maxDistance * 2) continue;
    out.push({ c, check: { offCentre, fill, distance, behaviour: c.behaviour }, sx, sy, sr });
  }
  return out.sort((a, b) => a.check.offCentre - b.check.offCentre);
}

function Stars({ n }: { n: number }) {
  return (
    <span className="ex-stars" aria-label={n + "/3"}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "on" : ""}>
          ★
        </span>
      ))}
    </span>
  );
}

export function SpeciesPic({ s, known, big }: { s: GuideSpecies; known: boolean; big?: boolean }) {
  const [bad, setBad] = useState(false);
  const url = known ? s.iconUrl : s.silhouetteUrl || s.iconUrl;
  useEffect(() => setBad(false), [url]);
  const cls = "ex-pic" + (big ? " big" : "") + (known ? "" : " shadow");
  if (url && !bad)
    return (
      <div className={cls}>
        <img src={url} alt="" draggable={false} onError={() => setBad(true)} crossOrigin={/mexty\.ai|mext\.app/.test(url) ? "use-credentials" : undefined} />
      </div>
    );
  return (
    <div className={cls + " icon"} aria-hidden>
      {s.icon}
    </div>
  );
}

function doing(api: ExpeditionApi, s: GuideSpecies | undefined, behaviour: string): string {
  const ui = api.exp.ui;
  if (!s) return "";
  if (behaviour === "feed" && api.t(s.feed)) return api.t(s.feed);
  if (behaviour === "special" && api.t(s.special)) return api.t(s.special);
  if (behaviour === "hide" || behaviour === "flee") return api.t(ui.doingHide);
  if (behaviour === "move") return api.t(ui.doingMove);
  return api.t(ui.doingIdle);
}

// ------------------------------------------------------------------ the viewfinder
export function CameraView({ api }: { api: ExpeditionApi }) {
  const { game, t, exp } = api;
  // local testing hook (never on the store's domains)
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) (window as unknown as Record<string, unknown>).__owInFrame = () => inFrame(game).map((s) => ({ species: s.c.species, ...s.check }));
  const ui = exp.ui;
  const [zoom, setZoom] = useState(0);
  const [target, setTarget] = useState<{ ok: boolean; x: number; y: number; r: number } | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    game.cam.fov = FOV_WIDE + (FOV_TELE - FOV_WIDE) * zoom;
  }, [zoom, game]);
  useEffect(() => {
    const iv = window.setInterval(() => {
      const s = inFrame(game)[0];
      setTarget(s ? { ok: s.check.offCentre <= PHOTO_RULES.ring, x: s.sx, y: s.sy, r: s.sr } : null);
    }, 120);
    return () => window.clearInterval(iv);
  }, [game]);
  // mouse wheel / pinch-less zoom keys: + and -
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Equal" || e.code === "NumpadAdd") setZoom((z) => Math.min(1, z + 0.1));
      else if (e.code === "Minus" || e.code === "NumpadSubtract") setZoom((z) => Math.max(0, z - 0.1));
      else if (e.code === "Escape") useExp.getState().setMode(null);
      else if (e.code === "KeyP") shoot();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shoot = () => {
    sound.shutter(exp.sounds && exp.sounds.shutter);
    setFlash((f) => f + 1);
    const best = inFrame(game)[0];
    const st = useExp.getState();
    if (!best) {
      window.setTimeout(() => useExp.setState({ photo: { photo: null, tip: t(ui.noCreature), best: false, newStages: 0 } }), 260);
      return;
    }
    const sid = best.c.species;
    const r = photoStars(best.check);
    const rec: PhotoRecord = { speciesId: sid, behaviour: best.check.behaviour === "flee" ? "hide" : best.check.behaviour, stars: r.stars, at: Date.now() };
    const pg = st.save.g[sid] || { st: 0 };
    const isBest = !pg.ph || rec.stars > pg.ph.stars;
    if (isBest) st.setSave({ ...st.save, g: { ...st.save.g, [sid]: { ...pg, ph: rec } } });
    let fresh = 0;
    if (st.save.tools.indexOf("guide") >= 0 || st.save.tools.indexOf("camera") >= 0) {
      if (api.addStage(sid, STAGE.seen)) fresh |= STAGE.seen;
      if (api.addStage(sid, STAGE.photo)) fresh |= STAGE.photo;
      if (r.acting && api.addStage(sid, STAGE.behaviour)) fresh |= STAGE.behaviour;
    }
    const tip = r.tip === "centre" ? t(ui.tipCentre) : r.tip === "closer" ? t(ui.tipCloser) : r.tip === "fill" ? t(ui.tipFill) : r.tip === "behaviour" ? t(ui.tipBehaviour) : t(ui.perfect);
    api.emit({ kind: "photo", id: sid, zone: api.zone });
    if (r.acting) api.emit({ kind: "observe", id: sid, zone: api.zone });
    window.setTimeout(() => {
      useExp.setState({ photo: { photo: rec, tip, best: isBest, newStages: fresh } });
      sound.sfx(r.stars >= 3 ? "success" : "chime", 0.7);
    }, 260);
  };
  return (
    <div className="ex-viewfinder">
      <div className="ex-frame" aria-hidden>
        <i className="tl" />
        <i className="tr" />
        <i className="bl" />
        <i className="br" />
      </div>
      <div className={"ex-ring" + (target && target.ok ? " ok" : "")} aria-hidden />
      {target && <div className={"ex-lock" + (target.ok ? " ok" : "")} style={{ left: target.x, top: target.y, width: Math.max(24, target.r * 2), height: Math.max(24, target.r * 2) }} aria-hidden />}
      {flash > 0 && <div className="ex-flash" key={flash} aria-hidden />}
      <div className="ex-cam-top">
        <span>📷 {t(ui.cameraHint)}</span>
        <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={() => useExp.getState().setMode(null)}>
          ✕
        </button>
      </div>
      <div className="ex-zoom" aria-label={t(ui.zoom)}>
        <button className="ow-round ex-small" aria-label={t(ui.zoom) + " +"} onClick={() => setZoom((z) => Math.min(1, z + 0.2))}>
          ➕
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          aria-label={t(ui.zoom)}
          className="ex-zoom-range"
        />
        <button className="ow-round ex-small" aria-label={t(ui.zoom) + " −"} onClick={() => setZoom((z) => Math.max(0, z - 0.2))}>
          ➖
        </button>
      </div>
      <button className="ex-shutter" aria-label={t(ui.shutter)} title={t(ui.shutter)} onClick={shoot}>
        <span />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ the photo card
export function PhotoCard({ api }: { api: ExpeditionApi }) {
  const { t, exp, young } = api;
  const ui = exp.ui;
  const res = useExp((s) => s.photo);
  const save = useExp((s) => s.save);
  if (!res) return null;
  const done = () => useExp.setState({ photo: null });
  const sp = res.photo ? api.species(res.photo.speciesId) : undefined;
  const newFacts = sp ? STAGES.map((b, i) => (res.newStages & b ? sp.facts[i] : null)).filter(Boolean) : [];
  const pg = sp ? save.g[sp.id] : undefined;
  return (
    <div className="ow-modal ex-modal" onPointerDown={(e) => e.target === e.currentTarget && done()}>
      <div className="ow-card ex-photo" role="dialog" aria-modal="true">
        {!res.photo || !sp ? (
          <>
            <div className="ex-photo-none" aria-hidden>
              🌫️
            </div>
            <p className="ex-text">{res.tip}</p>
          </>
        ) : (
          <>
            <div className="ex-polaroid">
              <SpeciesPic s={sp} known big />
              <div className="ex-polaroid-name">{t(sp.name)}</div>
              <div className="ex-polaroid-doing">{doing(api, sp, res.photo.behaviour)}</div>
            </div>
            <div className="ex-photo-stars">
              <Stars n={res.photo.stars} /> <span className="ex-small-text">{t(ui.starsLabel, { n: res.photo.stars })}</span>
            </div>
            <p className="ex-text">{res.tip}</p>
            {res.best && pg && pg.ph && res.photo.at === pg.ph.at && res.photo.stars > 1 && <div className="ex-badge">🏅 {t(ui.photoBest)}</div>}
            {!res.best && pg && pg.ph && <div className="ex-small-text">{t(ui.photoKept, { n: pg.ph.stars })}</div>}
            {newFacts.length > 0 && (
              <div className="ex-newfacts">
                <b>📖 {t(ui.newPage)}</b>
                {newFacts.map((f, i) => (
                  <p key={i}>{t(young ? f!.easy : f!.text)}</p>
                ))}
              </div>
            )}
          </>
        )}
        <div className="ow-row">
          {sp && save.tools.indexOf("guide") >= 0 && (
            <button
              className="ow-btn ow-btn-small"
              onClick={() => {
                useExp.setState({ photo: null, mode: "guide", page: sp.id });
              }}
            >
              📖 {t(ui.guide)}
            </button>
          )}
          <button className="ow-btn ow-btn-go" onClick={done} autoFocus>
            📷 {t(ui.next)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the Field Guide
const STAGE_KEYS = [
  ["stageSeen", "lockedSeen"],
  ["stagePhoto", "lockedPhoto"],
  ["stageId", "lockedId"],
  ["stageBehaviour", "lockedBehaviour"],
] as const;

export function FieldGuide({ api }: { api: ExpeditionApi }) {
  const { t, exp, young } = api;
  const ui = exp.ui;
  const save = useExp((s) => s.save);
  const page = useExp((s) => s.page);
  const close = () => useExp.getState().setMode(null);
  const list = exp.species || [];
  const sp = page ? list.find((s) => s.id === page) : undefined;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.code === "Escape" && (useExp.getState().page ? useExp.setState({ page: null }) : close());
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="ow-modal ex-modal" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="ex-book ow-card" role="dialog" aria-modal="true" aria-label={t(ui.guide)}>
        <div className="ex-book-head">
          {sp ? (
            <button className="ow-btn ow-btn-small" onClick={() => useExp.setState({ page: null })}>
              ◀ {t(ui.back)}
            </button>
          ) : (
            <div className="ex-book-title">📖 {t(ui.guide)}</div>
          )}
          <div className="ex-book-progress">{t(ui.guideProgress, { n: guideScore(save), total: list.length * 4 })}</div>
          <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={close}>
            ✕
          </button>
        </div>
        {!sp ? (
          <div className={"ex-book-grid" + (young ? " young" : "")}>
            {list.map((s) => {
              const pg = save.g[s.id];
              const st = pg ? pg.st : 0;
              return (
                <button key={s.id} className={"ex-book-cell" + (st ? " seen" : "")} onClick={() => useExp.setState({ page: s.id })}>
                  <SpeciesPic s={s} known={!!(st & STAGE.seen)} />
                  <span className="ex-cell-name">{st & STAGE.seen ? t(s.name) : "?"}</span>
                  <span className="ex-pips" aria-hidden>
                    {STAGES.map((b) => (
                      <i key={b} className={st & b ? "on" : ""} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <GuidePage api={api} s={sp} />
        )}
      </div>
    </div>
  );
}

function GuidePage({ api, s }: { api: ExpeditionApi; s: GuideSpecies }) {
  const { t, exp, young } = api;
  const ui = exp.ui;
  const save = useExp((x) => x.save);
  const pg = save.g[s.id];
  const st = pg ? pg.st : 0;
  const seen = !!(st & STAGE.seen);
  const facts = s.facts || [];
  // ages 4-6: the big picture and the newest fact in a few easy words
  const newest = STAGES.reduce((acc, b, i) => (st & b ? i : acc), -1);
  return (
    <div className={"ex-page" + (young ? " young" : "")}>
      <div className="ex-page-left">
        <SpeciesPic s={s} known={seen} big />
        <h2 className="ex-page-name">{seen ? t(s.name) : t(ui.unknown)}</h2>
        {st & STAGE.id ? <div className="ex-page-group">🔍 {t(s.group)}</div> : null}
        <div className="ex-page-photo">
          {pg && pg.ph ? (
            <>
              <span>📷 {t(ui.bestPhoto)}:</span> <Stars n={pg.ph.stars} /> <span className="ex-small-text">{doing(api, s, pg.ph.behaviour)}</span>
            </>
          ) : (
            <span className="ex-small-text">📷 {t(ui.noPhoto)}</span>
          )}
        </div>
        {seen && s.factAudio && t(s.factAudio) && (
          <button className="ow-btn ow-btn-small" onClick={() => sound.voice([t(s.factAudio)])}>
            🔈 {t(ui.listen)}
          </button>
        )}
      </div>
      <div className="ex-page-facts">
        {young ? (
          newest >= 0 && facts[newest] ? (
            <div className="ex-fact on">
              <div className="ex-fact-stage">{["👀", "📷", "🔍", "⭐"][newest]}</div>
              <p className="ex-fact-easy">{t(facts[newest].easy)}</p>
            </div>
          ) : (
            <div className="ex-fact">
              <p>{t(ui.lockedSeen)}</p>
            </div>
          )
        ) : (
          STAGES.map((b, i) => {
            const on = !!(st & b);
            const f = facts[i];
            return (
              <div key={b} className={"ex-fact" + (on ? " on" : "")}>
                <div className="ex-fact-stage">
                  {["👀", "📷", "🔍", "⭐"][i]} {t(ui[STAGE_KEYS[i][0]])}
                </div>
                {on && f ? (
                  <>
                    <p>{t(f.text)}</p>
                    <div className="ex-source">{t(ui.source, { source: f.source })}</div>
                  </>
                ) : (
                  <p className="ex-locked">🔒 {t(ui[STAGE_KEYS[i][1]])}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the hand lens
export function LensPanel({ api }: { api: ExpeditionApi }) {
  const { t, exp, game, young } = api;
  const ui = exp.ui;
  const lensOn = useExp((s) => s.lensOn);
  const save = useExp((s) => s.save);
  const sp = lensOn ? api.species(lensOn.species) : undefined;
  const feats = useMemo(() => {
    const m: Record<string, (typeof exp.lensFeatures)[number]> = {};
    for (const f of exp.lensFeatures || []) m[f.id] = f;
    return m;
  }, [exp.lensFeatures]);
  const [vals, setVals] = useState<Record<string, number | null>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [tries, setTries] = useState(0);
  const [right, setRight] = useState(false);
  const already = sp ? !!((save.g[sp.id] || { st: 0 }).st & STAGE.id) : false;
  // the camera comes close to the creature while the lens is open
  useEffect(() => {
    if (!lensOn) return;
    const c = game.creatures.find((x) => x.key === lensOn.key);
    if (!c) return;
    const iv = window.setInterval(() => {
      const p = new THREE.Vector3();
      c.obj.getWorldPosition(p);
      game.cam.focus = { x: p.x, y: p.y + c.cy, z: p.z, d: Math.max(1.2, c.radius * 4.2) };
    }, 50);
    return () => {
      window.clearInterval(iv);
      game.cam.focus = null;
    };
  }, [lensOn, game]);
  useEffect(() => {
    setVals({});
    setWrong([]);
    setTries(0);
    setRight(false);
  }, [lensOn && lensOn.key]);
  if (!lensOn || !sp) return null;
  const close = () => useExp.setState({ lensOn: null });
  const checks = sp.lens || [];
  const ready = checks.every((c) => vals[c.feature] != null);
  const check = () => {
    const bad = checks.filter((c) => vals[c.feature] !== c.value).map((c) => c.feature);
    const ok = bad.length === 0;
    const attempt = tries + 1;
    setTries(attempt);
    try {
      api.mexty.progress.answer({ questionId: "lens:" + sp.id, question: t(ui.lensTitle) + " — " + t(sp.name), correct: ok, attempt });
    } catch {
      /* outside EdVerse */
    }
    if (ok) {
      setRight(true);
      setWrong([]);
      sound.sfx("success", 0.9);
      api.addStage(sp.id, STAGE.seen);
      api.addStage(sp.id, STAGE.id);
      api.emit({ kind: "identify", id: sp.id, zone: api.zone });
    } else {
      setWrong(bad);
      sound.sfx("pop", 0.5);
    }
  };
  return (
    <div className="ex-lens ow-card" role="dialog" aria-label={t(ui.lensTitle)}>
      <div className="ex-lens-head">
        <div className="ex-lens-title">🔍 {t(ui.lensTitle)}</div>
        <button className="ow-round ow-close" aria-label={t(ui.close)} onClick={close}>
          ✕
        </button>
      </div>
      <div className="ex-lens-body">
        <div className="ex-lens-compare">
          <SpeciesPic s={sp} known />
          <div className="ex-small-text">{t(ui.lensCompare)}</div>
        </div>
        <div className="ex-lens-checks">
          {checks.map((c) => {
            const f = feats[c.feature];
            if (!f) return null;
            const v = vals[c.feature];
            const isWrong = wrong.indexOf(c.feature) >= 0;
            return (
              <div key={c.feature} className={"ex-check" + (isWrong ? " wrong" : "") + (right ? " right" : "")}>
                <div className="ex-check-q">
                  <span aria-hidden>{f.icon}</span> {t(f.question)}
                </div>
                {f.kind === "count" ? (
                  <div className="ex-count">
                    <button className="ow-round ex-small" disabled={right || !v} aria-label={t(ui.undo)} onClick={() => setVals({ ...vals, [c.feature]: Math.max(0, (v || 0) - 1) })}>
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
                    <button className="ow-round ex-small" disabled={right || (v || 0) >= f.max} aria-label="+" onClick={() => setVals({ ...vals, [c.feature]: Math.min(f.max, (v || 0) + 1) })}>
                      ➕
                    </button>
                  </div>
                ) : (
                  <div className="ow-seg ex-yesno">
                    <button className={v === 1 ? "on" : ""} disabled={right} onClick={() => setVals({ ...vals, [c.feature]: 1 })}>
                      👍 {t(ui.yes)}
                    </button>
                    <button className={v === 0 ? "on" : ""} disabled={right} onClick={() => setVals({ ...vals, [c.feature]: 0 })}>
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
      </div>
      {wrong.length > 0 && <div className="ex-kind center">{t(ui.lensWrong)}</div>}
      {right ? (
        <div className="ex-good">
          <b>✅ {t(ui.lensRight, { group: t(sp.group) })}</b>
          {sp.facts[2] && <p>{t(young ? sp.facts[2].easy : sp.facts[2].text)}</p>}
          <button className="ow-btn ow-btn-go" onClick={close} autoFocus>
            {t(ui.next)} ➜
          </button>
        </div>
      ) : (
        <button className="ow-btn ow-btn-go" disabled={!ready} onClick={check}>
          🔍 {t(ui.lensCheck)}
        </button>
      )}
      {already && !right && <div className="ex-small-text center">✔ {t(ui.stageId)}</div>}
    </div>
  );
}
