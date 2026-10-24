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

/** A parchment card: a lantern's idea, or a district stall that is coming soon. */
export function InfoCard({ card, props, t, language, onClose }: { card: CardState; props: BlockProps; t: T; language: string; onClose: () => void }) {
  const ui = props.ui;
  let body: React.ReactNode = null;
  if (card.kind === "lantern") {
    const l = !card.empty && card.index != null ? (props.lanterns || [])[card.index] : undefined;
    if (l) {
      const place = (props.districtNames || []).find((d) => d.id === l.where);
      const date = fmtDate(l.shippedAt, language);
      body = (
        <>
          <div className="ow-card-icon">🏮</div>
          <div className="ow-card-kicker">{t(ui.ideaBy, { nickname: l.nickname })}</div>
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
    if (d)
      body = (
        <>
          {d.imageUrl && <img className="ow-card-img" src={d.imageUrl} alt={t(d.imageAlt)} draggable={false} />}
          <div className="ow-badge">✨ {t(ui.comingSoon)}</div>
          <h2 className="ow-card-title">{t(d.name)}</h2>
          <p className="ow-card-text">{t(d.teaser)}</p>
          <p className="ow-card-text">
            <b>{t(ui.youWillLearn)}</b> {t(d.learns)}
          </p>
          <p className="ow-card-small">{t(ui.comingSoonText)}</p>
        </>
      );
  }
  return (
    <div className="ow-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ow-card ow-info" role="dialog" aria-modal="true">
        {body}
        <button className="ow-btn ow-btn-go" onClick={onClose} autoFocus>
          {t(ui.close)}
        </button>
      </div>
    </div>
  );
}
