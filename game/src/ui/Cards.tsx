import React from "react";
import type { BlockProps, T } from "../block";

export interface CardState {
  kind: "lantern" | "stall" | "telescope";
  index?: number;
  district?: string;
  empty?: boolean;
}

function fmtDate(iso: string, language: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return d.toDateString();
  }
}

/** A parchment card: a lantern's idea, or a district stall with its door into the district. */
export function InfoCard({ card, props, t, language, onClose, onEnter, onReport }: {
  card: CardState;
  props: BlockProps;
  t: T;
  language: string;
  onClose: () => void;
  /** Walk into a district (its stall's card); absent when the district cannot be entered. */
  onEnter?: (district: string) => void;
  /** One-tap report of what the card shows (a lantern). */
  onReport?: (target: { id: string; label: string }) => void;
}) {
  const ui = props.ui;
  let body: React.ReactNode = null;
  let flag: { id: string; label: string } | null = null;
  let enter: string | null = null;
  if (card.kind === "lantern") {
    const l = !card.empty && card.index != null ? (props.lanterns || [])[card.index] : undefined;
    if (l) {
      const place = (props.districtNames || []).find((d) => d.id === l.where);
      const date = fmtDate(l.shippedAt, language);
      flag = { id: "lantern:" + card.index, label: t(l.title) };
      body = (
        <>
          <div className="ow-card-icon">🏮</div>
          <div className="ow-card-kicker">{l.by === "team" && ui.ideaByTeam ? t(ui.ideaByTeam) : t(ui.ideaBy, { nickname: l.nickname })}</div>
          <h2 className="ow-card-title">{t(l.title)}</h2>
          <div className="ow-card-meta">
            {place && <span>📍 {t(ui.livesIn, { place: t(place.name) })}</span>}
            {date && <span>🛠️ {t(ui.builtOn, { date })}</span>}
          </div>
        </>
      );
    } else {
      body = (
        <>
          <div className="ow-card-icon dim">🏮</div>
          <p className="ow-card-text">{t(ui.noLanterns)}</p>
        </>
      );
    }
  } else if (card.kind === "stall") {
    const d = (props.districts || []).find((x) => x.id === card.district);
    if (d) {
      if (onEnter) enter = d.id;
      body = (
        <>
          {d.imageUrl && <img className="ow-card-img" src={d.imageUrl} alt={t(d.imageAlt)} draggable={false} />}
          <div className="ow-badge">✨ {onEnter && ui.nowOpen ? t(ui.nowOpen) : t(ui.comingSoon)}</div>
          <h2 className="ow-card-title">{t(d.name)}</h2>
          <p className="ow-card-text">{t(d.teaser)}</p>
          <p className="ow-card-text">
            <b>{t(ui.youWillLearn)}</b> {t(d.learns)}
          </p>
          {!!(d.previews && d.previews.length) && (
            <p className="ow-card-text">
              <b>{t(ui.youWillSee)}</b>{" "}
              {d.previews.slice(0, 3).map((p, i) => (
                <span key={i}>
                  {i > 0 ? " · " : ""}
                  {t(p.label)}
                  {p.credit ? <span className="ow-card-small"> ({p.credit})</span> : null}
                </span>
              ))}
            </p>
          )}
          {!onEnter && <p className="ow-card-small">{t(ui.comingSoonText)}</p>}
        </>
      );
    }
  }
  const place = enter ? (props.districts || []).find((x) => x.id === enter) : undefined;
  return (
    <div className="ow-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ow-card ow-info" role="dialog" aria-modal="true">
        {flag && onReport && (
          <button className="ow-flag" aria-label={t(ui.report)} title={t(ui.report)} onClick={() => onReport(flag!)}>
            🚩
          </button>
        )}
        {body}
        {enter && onEnter && place ? (
          <div className="ow-row ow-row-center">
            <button className="ow-btn ow-btn-go" onClick={() => onEnter(enter!)} autoFocus>
              🚪 {t(ui.enterDistrict, { place: t(place.name) })} ➜
            </button>
            <button className="ow-btn ow-btn-small" onClick={onClose}>
              {t(ui.close)}
            </button>
          </div>
        ) : (
          <button className="ow-btn ow-btn-go" onClick={onClose} autoFocus>
            {t(ui.close)}
          </button>
        )}
      </div>
    </div>
  );
}
