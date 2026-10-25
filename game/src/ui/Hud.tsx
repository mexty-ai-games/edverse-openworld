import React, { useEffect, useRef, useState } from "react";
import type { BlockProps, T } from "../block";
import type { Game, Target } from "../game/state";
import type { Presence } from "../game/net";
import { Quality, setSettings, TOUCH, useSettings } from "../settings";
import { sound } from "../audio";

/** On-screen stick for touch: drag from its centre; it writes the movement wish into the game. */
function Stick({ game }: { game: Game }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (cx: number, cy: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2;
    let dx = cx - (r.left + R);
    let dy = cy - (r.top + R);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx *= R / d;
      dy *= R / d;
    }
    setKnob({ x: dx, y: dy });
    const k = Math.min(1, d / (R * 0.85));
    game.input.x = d > 4 ? (dx / Math.max(d, 1)) * k : 0;
    game.input.z = d > 4 ? (dy / Math.max(d, 1)) * k : 0;
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    game.input.x = game.input.z = 0;
  };
  return (
    <div
      ref={base}
      className="ow-stick"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current === e.pointerId && move(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="ow-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export function Hud({ props, t, game, presence, roomInfo, blocked, onBack, found, zoneName, onHome, onSpeak, labelFor }: {
  props: BlockProps;
  t: T;
  game: Game;
  presence: Presence | null;
  roomInfo: { online: boolean; reason: string };
  blocked: boolean;
  onBack: () => void;
  found: number;
  /** Inside a district: its name (chip) and the way home. */
  zoneName?: string;
  onHome?: () => void;
  /** The speaker button: say the place's short voice lines again. */
  onSpeak?: () => void;
  /** A district's own label for the action button ([icon, text]), or null for the default. */
  labelFor?: (target: Target) => [string, string] | null;
}) {
  const ui = props.ui;
  const settings = useSettings();
  const [focus, setFocus] = useState<Target | null>(null);
  const [others, setOthers] = useState(0);
  const [panel, setPanel] = useState<null | "say" | "settings">(null);
  const [hint, setHint] = useState(true);
  const lastSay = useRef(0);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setFocus(game.focus);
      setOthers(presence ? presence.count() : 0);
    }, 150);
    const h = window.setTimeout(() => setHint(false), 9000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(h);
    };
  }, [game, presence]);

  const act = () => {
    const f = game.focus;
    if (!f) return;
    // the same as tapping the thing in the world
    const ev = new CustomEvent("ow-open", { detail: f });
    window.dispatchEvent(ev);
  };

  const say = (id: string, anim: string) => {
    const now = performance.now();
    if (now - lastSay.current < 1200) return;
    lastSay.current = now;
    game.say(id, anim);
    sound.sfx("pop", 0.8);
    setPanel(null);
  };

  // keyboard: arrows / WASD (physical keys, so ZQSD on AZERTY), E or Enter to use, 1–8 phrases, Esc closes
  useEffect(() => {
    const held = new Set<string>();
    const update = () => {
      let x = 0;
      let z = 0;
      held.forEach((c) => {
        x += KEYS[c][0];
        z += KEYS[c][1];
      });
      game.input.x = x;
      game.input.z = z;
    };
    const down = (e: KeyboardEvent) => {
      if (blocked) return;
      if (KEYS[e.code]) {
        held.add(e.code);
        update();
        e.preventDefault();
      } else if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") {
        act();
        e.preventDefault();
      } else if (/^Digit[1-8]$/.test(e.code)) {
        const p = (props.phrases || [])[Number(e.code.slice(5)) - 1];
        if (p) say(p.id, p.anim);
      } else if (e.code === "Escape") setPanel(null);
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) update();
    };
    const blur = () => {
      held.clear();
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      game.input.x = game.input.z = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, blocked, props.phrases]);

  const lanternCount = (props.lanterns || []).length;
  const custom = focus && labelFor ? labelFor(focus) : null;
  const actLabel = custom ? custom[1] : focus ? (focus.kind === "lantern" ? t(ui.readLantern) : focus.kind === "telescope" ? t(ui.useTelescope) : t(ui.look)) : "";
  const actIcon = custom ? custom[0] : focus ? (focus.kind === "lantern" ? "🏮" : focus.kind === "telescope" ? "🔭" : "👀") : "";
  const total = (props.constellations || []).length;
  const qualities: [Quality, string][] = [
    ["auto", t(ui.qualityAuto)],
    ["low", t(ui.qualityLow)],
    ["medium", t(ui.qualityMedium)],
    ["high", t(ui.qualityHigh)],
  ];

  return (
    <div className={"ow-hud" + (blocked ? " blocked" : "")}>
      <div className="ow-chips">
        {zoneName ? (
          <div className="ow-chip ow-chip-zone">📍 {zoneName}</div>
        ) : (
          <>
            <div className="ow-chip">🏮 {lanternCount ? t(ui.lanternCount, { n: lanternCount }) : "0"}</div>
            <div className="ow-chip">⭐ {t(ui.skyProgress, { n: Math.min(found, total), total })}</div>
          </>
        )}
        <div className="ow-chip" title={roomInfo.online ? "" : t(ui.roomNote)}>
          👥 {roomInfo.online && others > 0 ? t(ui.explorersHere, { n: others + 1 }) : t(ui.aloneHere)}
        </div>
      </div>
      <div className="ow-topright">
        {onHome && (
          <button className="ow-round" aria-label={t(ui.backToGrove)} title={t(ui.backToGrove)} onClick={onHome}>
            🌳
          </button>
        )}
        {onSpeak && (
          <button className="ow-round" aria-label={t(ui.listen)} title={t(ui.listen)} onClick={onSpeak}>
            🔈
          </button>
        )}
        <button className="ow-round" aria-label={t(ui.settings)} onClick={() => setPanel(panel === "settings" ? null : "settings")}>
          ⚙️
        </button>
      </div>
      {hint && <div className="ow-hint">{t(TOUCH ? ui.howToTouch : ui.howToKeys)}</div>}
      {TOUCH && <Stick game={game} />}
      <div className="ow-actions">
        <button className="ow-round ow-say" aria-label={t(ui.say)} onClick={() => setPanel(panel === "say" ? null : "say")}>
          💬
        </button>
        {focus && (
          <button className="ow-btn ow-act" onClick={act}>
            <span className="ow-act-icon">{actIcon}</span>
            {actLabel}
          </button>
        )}
      </div>
      {panel === "say" && (
        <div className="ow-panel ow-phrases" role="menu" aria-label={t(ui.say)}>
          {(props.phrases || []).map((p, i) => (
            <button key={p.id} className="ow-phrase" role="menuitem" onClick={() => say(p.id, p.anim)}>
              <span className="ow-phrase-icon">{p.icon}</span>
              <span className="ow-phrase-text">{t(p.text)}</span>
              {!TOUCH && <span className="ow-key">{i + 1}</span>}
            </button>
          ))}
        </div>
      )}
      {panel === "settings" && (
        <div className="ow-panel ow-settings">
          <h3>{t(ui.settings)}</h3>
          <div className="ow-setting-label">{t(ui.quality)}</div>
          <div className="ow-seg">
            {qualities.map(([q, label]) => (
              <button key={q} className={settings.quality === q ? "on" : ""} onClick={() => setSettings({ quality: q })}>
                {label}
              </button>
            ))}
          </div>
          <div className="ow-setting-label">{t(ui.sound)}</div>
          <div className="ow-seg">
            <button className={settings.sound ? "on" : ""} onClick={() => setSettings({ sound: true })}>
              🔊 {t(ui.on)}
            </button>
            <button className={!settings.sound ? "on" : ""} onClick={() => setSettings({ sound: false })}>
              🔇 {t(ui.off)}
            </button>
          </div>
          <div className="ow-row">
            <button className="ow-btn ow-btn-small" onClick={onBack}>
              🧒 {t(ui.changeExplorer)}
            </button>
            <button className="ow-btn ow-btn-small" onClick={() => setPanel(null)}>
              {t(ui.close)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
