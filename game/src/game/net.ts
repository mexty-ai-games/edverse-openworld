// Presence: other explorers' avatars, nicknames and phrase bubbles. No text is ever typed: a message
// carries a generated nickname, an avatar preset number, a position and a phrase id from the props.
// Messages travel over Mexty's LiveKit rooms (as the store's multiplayer games do); on a developer's
// machine two tabs talk through a BroadcastChannel. One room per EdVerse age tile, so explorers more
// than one tile apart never meet in an open room (here: only the same tile).
import type { Game, Peer } from "./state";

type Msg = { t: string; [k: string]: unknown };
type Handler = (msg: Msg, from: string) => void;

interface Transport {
  send(msg: Msg): void;
  onMessage(h: Handler): void;
  onLeave(h: (id: string) => void): void;
  close(): void;
}

const LOCAL = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const TILES = [4, 7, 10, 13, 16];

/** The open room for a player's ages, or null when no age is known (then the explorer plays alone). */
export function roomForAge(ageMin: number | null, ageMax: number | null): string | null {
  let lo = ageMin;
  let hi = ageMax;
  if (lo == null && hi == null && LOCAL) {
    const q = Number(new URLSearchParams(window.location.search).get("age"));
    if (q) lo = hi = q;
  }
  if (lo == null && hi == null) return null;
  const age = lo != null && hi != null ? (lo + hi) / 2 : ((lo ?? hi) as number);
  let tile = 0;
  for (let i = 0; i < TILES.length; i++) if (age >= TILES[i]) tile = i;
  return "edverse-openworld-idea-grove-t" + tile;
}

class LocalTransport implements Transport {
  readonly me = "dev-" + Math.random().toString(36).slice(2, 8);
  private ch: BroadcastChannel;
  private handlers: Handler[] = [];
  private leaves: ((id: string) => void)[] = [];
  constructor(name: string) {
    this.ch = new BroadcastChannel(name);
    this.ch.onmessage = (e) => {
      const { from, msg } = e.data as { from: string; msg: Msg };
      if (msg.t === "bye") this.leaves.forEach((h) => h(from));
      else this.handlers.forEach((h) => h(msg, from));
    };
  }
  send(msg: Msg) {
    this.ch.postMessage({ from: this.me, msg });
  }
  onMessage(h: Handler) {
    this.handlers.push(h);
  }
  onLeave(h: (id: string) => void) {
    this.leaves.push(h);
  }
  close() {
    try {
      this.ch.postMessage({ from: this.me, msg: { t: "bye" } });
      this.ch.close();
    } catch {
      /* closed */
    }
  }
}

class LiveKitTransport implements Transport {
  private handlers: Handler[] = [];
  private leaves: ((id: string) => void)[] = [];
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private room: any) {}

  static async open(name: string, apiUrl: string): Promise<LiveKitTransport> {
    const res = await fetch(apiUrl.replace(/\/$/, "") + "/api/livekit/token", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: name }),
    });
    if (!res.ok) throw new Error("token " + res.status);
    const data = await res.json();
    if (!data || !data.token || !data.serverUrl) throw new Error("token");
    const lk = await import("livekit-client");
    const room = new lk.Room({ adaptiveStream: false, dynacast: false });
    const tr = new LiveKitTransport(room);
    room.on(lk.RoomEvent.DataReceived, (payload: Uint8Array, participant?: { identity: string }, _k?: unknown, topic?: string) => {
      if (topic !== "ow" || !participant) return;
      try {
        const msg = JSON.parse(tr.dec.decode(payload)) as Msg;
        tr.handlers.forEach((h) => h(msg, participant.identity));
      } catch {
        /* not ours */
      }
    });
    room.on(lk.RoomEvent.ParticipantDisconnected, (p: { identity: string }) => tr.leaves.forEach((h) => h(p.identity)));
    await room.connect(data.serverUrl, data.token, { autoSubscribe: false });
    return tr;
  }
  send(msg: Msg) {
    if (this.room.state !== "connected") return;
    this.room.localParticipant.publishData(this.enc.encode(JSON.stringify(msg)), { reliable: false, topic: "ow" }).catch(() => undefined);
  }
  onMessage(h: Handler) {
    this.handlers.push(h);
  }
  onLeave(h: (id: string) => void) {
    this.leaves.push(h);
  }
  close() {
    try {
      this.room.disconnect();
    } catch {
      /* gone */
    }
  }
}

export interface Presence {
  count(): number;
  close(): void;
}

const NICK = /^[A-Za-z]{2,14} [A-Za-z]{2,14} \d{2}$/;
const ID = /^[a-z0-9-]{1,24}$/;
const r2 = (v: number) => Math.round(v * 100) / 100;
const MAX_PEERS = 24;

export async function openPresence(room: string, apiUrl: string, game: Game): Promise<Presence> {
  const tr: Transport = LOCAL && !apiUrl ? new LocalTransport(room) : await LiveKitTransport.open(room, apiUrl);
  const peers = game.peers;
  let last = { x: 1e9, z: 1e9, r: 0, m: false, e: "", at: 0 };

  const state = (): Msg => {
    const me = game.me;
    return { t: "s", n: game.nickname, a: game.avatar, x: r2(me.x), z: r2(me.z), r: r2(me.ry), m: me.moving ? 1 : 0 };
  };

  // ~8 times a second while moving, once a second while still
  const iv = window.setInterval(() => {
    if (game.mode !== "play" || game.paused) return;
    const me = game.me;
    const now = performance.now();
    const changed = Math.abs(me.x - last.x) > 0.04 || Math.abs(me.z - last.z) > 0.04 || Math.abs(me.ry - last.r) > 0.05 || me.moving !== last.m;
    if (changed || now - last.at > 1000) {
      tr.send(state());
      last = { x: me.x, z: me.z, r: me.ry, m: me.moving, e: "", at: now };
    }
  }, 125);

  game.onSay = (phraseId, anim) => tr.send({ t: "p", p: phraseId, e: anim });

  tr.onMessage((m, from) => {
    const now = performance.now();
    let p = peers.get(from);
    if (m.t === "s") {
      const nick = String(m.n || "");
      const x = Number(m.x);
      const z = Number(m.z);
      if (!NICK.test(nick) || !isFinite(x) || !isFinite(z)) return;
      if (!p) {
        if (peers.size >= MAX_PEERS) return;
        p = { id: from, nick, avatar: 0, x, z, ry: 0, tx: x, tz: z, tr: 0, moving: false, emote: "", emoteAt: 0, phrase: null, phraseAt: 0, seen: now };
        peers.set(from, p);
        game.peerVersion++;
        // say hello back so the newcomer sees us at once
        tr.send(state());
      }
      p.nick = nick;
      p.avatar = Math.max(0, Math.min(15, Math.floor(Number(m.a) || 0)));
      p.tx = Math.max(-30, Math.min(30, x));
      p.tz = Math.max(-30, Math.min(30, z));
      p.tr = Number(m.r) || 0;
      p.moving = !!m.m;
      p.seen = now;
    } else if (m.t === "p" && p) {
      const id = String(m.p || "");
      if (!ID.test(id)) return;
      p.phrase = id;
      p.phraseAt = now;
      const e = String(m.e || "");
      if (e === "wave" || e === "cheer") {
        p.emote = e;
        p.emoteAt = now;
      }
      p.seen = now;
    }
  });
  tr.onLeave((id) => {
    if (peers.delete(id)) game.peerVersion++;
  });
  const prune = window.setInterval(() => {
    const now = performance.now();
    peers.forEach((p: Peer, id: string) => {
      if (now - p.seen > 6000) {
        peers.delete(id);
        game.peerVersion++;
      }
    });
  }, 1000);
  tr.send(state());

  return {
    count: () => peers.size,
    close: () => {
      window.clearInterval(iv);
      window.clearInterval(prune);
      game.onSay = null;
      peers.clear();
      game.peerVersion++;
      tr.close();
    },
  };
}
