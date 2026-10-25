// Shared rows (phase 3): the community garden, the museum's displays, the stickers and the BioBlitz live in
// @mexty/sdk shared collections, read by every player of the game. A row holds only ids, numbers and the
// platform's generated nickname: never text a child typed. Each player writes one row per collection
// (`shared.set`, debounced by the SDK), so the collections never grow past one row per player.
// On a developer's machine (and for guests, whose rows the platform does not keep) the same calls run
// against localStorage, so two tabs share a garden and the game works the same without a server.
import type { useMexty } from "@mexty/sdk";

export interface Row<T = Record<string, unknown>> {
  key?: string;
  nickname: string;
  data: T;
  mine: boolean;
  updatedAt: string | null;
}

export interface SharedIO {
  list(collection: string): Promise<Row[]>;
  set(collection: string, key: string, data: Record<string, unknown>): Promise<void>;
}

type Mexty = ReturnType<typeof useMexty>;

const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const DEV_KEY = "ow-dev-shared";

function devOwner(): string {
  try {
    let id = sessionStorage.getItem("ow-dev-owner");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("ow-dev-owner", id);
    }
    return id;
  } catch {
    return "me";
  }
}

type DevRow = { owner: string; key: string; nickname: string; data: Record<string, unknown>; updatedAt: string };

function devRead(): Record<string, DevRow[]> {
  try {
    return JSON.parse(localStorage.getItem(DEV_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** The shared rows: the SDK's, with this player's own rows kept here too (a guest's are never stored by the platform). */
export function makeShared(mexty: Mexty, nickname: () => string): SharedIO {
  const own: Record<string, Row> = {};
  if (LOCAL) {
    const owner = devOwner();
    return {
      async list(c) {
        const all = devRead()[c] || [];
        return all.map((r) => ({ key: r.key, nickname: r.nickname, data: r.data, mine: r.owner === owner, updatedAt: r.updatedAt }));
      },
      async set(c, key, data) {
        const all = devRead();
        const list = (all[c] || []).filter((r) => !(r.owner === owner && r.key === key));
        list.unshift({ owner, key, nickname: nickname(), data, updatedAt: new Date().toISOString() });
        all[c] = list.slice(0, 200);
        try {
          localStorage.setItem(DEV_KEY, JSON.stringify(all));
        } catch {
          /* full */
        }
      },
    };
  }
  return {
    async list(c) {
      let rows: Row[] = [];
      try {
        rows = (await mexty.shared.list(c, { limit: 200 })) as Row[];
      } catch {
        rows = [];
      }
      // this player's latest write, even before the server has it (or when it never will: a guest)
      for (const k of Object.keys(own)) {
        const [col, key] = k.split("|");
        if (col !== c) continue;
        const i = rows.findIndex((r) => r.mine && r.key === key);
        if (i >= 0) rows[i] = { ...rows[i], data: own[k].data };
        else rows.unshift(own[k]);
      }
      return rows;
    },
    async set(c, key, data) {
      own[c + "|" + key] = { key, nickname: nickname(), data, mine: true, updatedAt: new Date().toISOString() };
      try {
        await mexty.shared.set(c, key, data);
      } catch {
        /* offline: kept here for this visit */
      }
    },
  };
}
