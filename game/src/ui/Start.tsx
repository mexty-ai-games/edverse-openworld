import React from "react";
import type { AvatarPreset, T, UiText } from "../block";
import { TOUCH } from "../settings";

/** A little face of a preset, for the picker (skin, hair, shirt). */
export function PresetFace({ p }: { p: AvatarPreset }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 64 C10 46 22 42 32 42 C42 42 54 46 56 64 Z" fill={p.shirt} />
      <circle cx="32" cy="28" r="17" fill={p.skin} />
      <path d="M14 26 C14 10 50 8 50 26 C46 18 40 16 32 17 C24 16 18 18 14 26 Z" fill={p.hair} />
      <circle cx="26" cy="29" r="2.6" fill="#2b1d14" />
      <circle cx="38" cy="29" r="2.6" fill="#2b1d14" />
      <path d="M26 36 Q32 41 38 36" stroke="#7a2e22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Start({ ui, t, avatars, avatar, nickname, onAvatar, onReroll, onEnter }: {
  ui: UiText;
  t: T;
  avatars: AvatarPreset[];
  avatar: number;
  nickname: string;
  onAvatar: (i: number) => void;
  onReroll: () => void;
  onEnter: () => void;
}) {
  return (
    <div className="ow-start">
      <div className="ow-card ow-start-card">
        <h1 className="ow-title">{t(ui.title)}</h1>
        <p className="ow-tagline">{t(ui.tagline)}</p>
        <h2 className="ow-h2">{t(ui.chooseLook)}</h2>
        <div className="ow-presets" role="radiogroup" aria-label={t(ui.chooseLook)}>
          {avatars.map((p, i) => (
            <button key={p.id} role="radio" aria-checked={i === avatar} className={"ow-preset" + (i === avatar ? " on" : "")} onClick={() => onAvatar(i)}>
              <PresetFace p={p} />
            </button>
          ))}
        </div>
        <h2 className="ow-h2">{t(ui.yourName)}</h2>
        <div className="ow-namebox">
          <span className="ow-name">{nickname}</span>
          <button className="ow-btn ow-btn-small" onClick={onReroll} aria-label={t(ui.newName)}>
            🎲 {t(ui.newName)}
          </button>
        </div>
        <button className="ow-btn ow-btn-go" onClick={onEnter}>
          {t(ui.enter)} ➜
        </button>
        <p className="ow-howto">{t(TOUCH ? ui.howToTouch : ui.howToKeys)}</p>
      </div>
    </div>
  );
}
