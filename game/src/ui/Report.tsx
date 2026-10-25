// One-tap report (rule 9): a player's name tag, a lantern or a district object → five picture reasons,
// sent to the EdVerse player (EDVERSE_REPORT), which files it in the staff queue. No text box, ever.
import React, { useState } from "react";
import type { T, UiText } from "../block";

export type ReportReason = "unkind" | "scary" | "personal-info" | "broken" | "other";
export type ReportStatus = "sent" | "guest" | "limit" | "invalid" | "error";

export interface ReportTarget {
  kind: "player" | "object";
  /** Presence peer id, or e.g. "lantern:2", "skyharbor:info:airship". */
  id: string;
  /** Nickname or object name shown on the sheet (never a real name). */
  label: string;
}

/** Ids may only use these characters and at most 80 of them (the player's contract). */
export function reportId(raw: string): string {
  return String(raw).replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80) || "unknown";
}

let seq = 0;

/** Posts the report to the EdVerse player and waits for its answer (a quiet "error" after 8 s or outside EdVerse). */
export function sendReport(target: ReportTarget, reason: ReportReason): Promise<ReportStatus> {
  const requestId = "ow-" + Date.now().toString(36) + "-" + (++seq).toString(36);
  const msg = {
    type: "EDVERSE_REPORT",
    target: { kind: target.kind, id: reportId(target.id), label: String(target.label || "").slice(0, 80) },
    reason,
    requestId,
  };
  return new Promise((resolve) => {
    if (typeof window === "undefined" || window.parent === window) {
      resolve("error");
      return;
    }
    let done = false;
    const finish = (s: ReportStatus) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      window.clearTimeout(timer);
      resolve(s);
    };
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; requestId?: string; status?: string } | null;
      if (!d || d.type !== "EDVERSE_REPORT_RESULT" || d.requestId !== requestId) return;
      const s = d.status;
      finish(s === "sent" || s === "guest" || s === "limit" || s === "invalid" ? s : "error");
    };
    window.addEventListener("message", onMsg);
    const timer = window.setTimeout(() => finish("error"), 8000);
    try {
      window.parent.postMessage(msg, "*");
    } catch {
      finish("error");
    }
  });
}

const REASONS: { id: ReportReason; icon: string; key: keyof UiText }[] = [
  { id: "unkind", icon: "😢", key: "reportUnkind" },
  { id: "scary", icon: "😨", key: "reportScary" },
  { id: "personal-info", icon: "🔒", key: "reportPersonal" },
  { id: "broken", icon: "🔧", key: "reportBroken" },
  { id: "other", icon: "❓", key: "reportOther" },
];

/** The small sheet: five big picture buttons, plus Hide / Show for a player. */
export function ReportSheet({ target, ui, t, hidden, onToggleHide, onReport, onClose }: {
  target: ReportTarget;
  ui: UiText;
  t: T;
  /** For a player: hidden for me right now. */
  hidden?: boolean;
  onToggleHide?: () => void;
  onReport: (reason: ReportReason) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="ow-modal ow-report-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ow-card ow-report" role="dialog" aria-modal="true" aria-label={t(ui.reportTitle)}>
        <div className="ow-report-head">
          <span className="ow-report-flag" aria-hidden="true">
            🚩
          </span>
          <div>
            <div className="ow-card-kicker">{t(ui.reportTitle)}</div>
            <div className="ow-report-who">{target.kind === "player" ? "🧒 " : ""}{target.label}</div>
          </div>
        </div>
        <div className="ow-report-reasons">
          {REASONS.map((r) => (
            <button
              key={r.id}
              className="ow-report-reason"
              disabled={busy}
              aria-label={t(ui[r.key] as UiText["reportOther"])}
              onClick={() => {
                setBusy(true);
                onReport(r.id);
              }}
            >
              <span className="ow-report-icon">{r.icon}</span>
              <span className="ow-report-text">{t(ui[r.key] as UiText["reportOther"])}</span>
            </button>
          ))}
        </div>
        <div className="ow-row">
          {target.kind === "player" && onToggleHide && (
            <button className="ow-btn ow-btn-small" onClick={onToggleHide}>
              {hidden ? "👀 " + t(ui.showPlayer) : "🙈 " + t(ui.hidePlayer)}
            </button>
          )}
          <button className="ow-btn ow-btn-small" onClick={onClose} autoFocus>
            {t(ui.close)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A short note after a report: thanks, or ask a grown-up to sign in. */
export function ReportNote({ status, ui, t, onClose }: { status: ReportStatus; ui: UiText; t: T; onClose: () => void }) {
  const text = status === "guest" ? t(ui.reportGuest) : status === "sent" || status === "limit" ? t(ui.reportThanks) : t(ui.reportError);
  const icon = status === "guest" ? "👪" : status === "sent" || status === "limit" ? "💛" : "🌧️";
  return (
    <div className="ow-toast" role="status" onPointerDown={onClose}>
      <span className="ow-toast-icon">{icon}</span> {text}
    </div>
  );
}
