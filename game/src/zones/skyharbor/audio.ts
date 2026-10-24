// Skyharbor's own sounds (night ambience, robot beeps) on a small Web Audio engine of the district.
// It follows the same rules as the hub's: silent until a tap, the player's sound setting, the store's
// mute and pause. The hub's chime / pop / success effects are played through the hub's engine.
import type { SkyharborSounds } from "./types";

type Id = "beep" | "bump" | "whirr";

function needsLogin(url: string): boolean {
  return /(^|\.)mexty\.ai\/|(^|\.)mext\.app\//.test(url.replace(/^https?:\/\//, ""));
}

class DistrictSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private urls: Partial<SkyharborSounds> = {};
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private amb: AudioBufferSourceNode | null = null;
  private ambGain: GainNode | null = null;
  private wantAmb = false;
  private muted = false;
  private paused = false;

  configure(s: SkyharborSounds) {
    this.urls = s || {};
    if (this.ctx) this.preload();
  }

  /** Call from a tap (browsers start audio only after one). */
  unlock() {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply();
      this.preload();
    }
    if (this.ctx.state === "suspended" && !this.paused) this.ctx.resume().catch(() => undefined);
    if (this.wantAmb && !this.amb) this.startAmbience();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.apply();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend().catch(() => undefined);
    else this.ctx.resume().catch(() => undefined);
  }

  private apply() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  private preload() {
    Object.values(this.urls).forEach((u) => u && this.load(u));
  }

  private load(url: string): Promise<AudioBuffer | null> {
    const have = this.buffers.get(url);
    if (have) return Promise.resolve(have);
    const going = this.loading.get(url);
    if (going) return going;
    const p = fetch(url, { credentials: needsLogin(url) ? "include" : "same-origin" })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => new Promise<AudioBuffer>((res, rej) => this.ctx!.decodeAudioData(data, res, rej)))
      .then((b) => {
        this.buffers.set(url, b);
        return b;
      })
      .catch(() => null);
    this.loading.set(url, p);
    return p;
  }

  play(id: Id, vol = 1, rate = 1) {
    if (!this.ctx || this.muted || !this.master) return;
    const url = this.urls[id];
    const buf = url ? this.buffers.get(url) : undefined;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  startAmbience() {
    this.wantAmb = true;
    const url = this.urls.ambience;
    if (!this.ctx || this.amb || !url || !this.master) return;
    this.load(url).then((buf) => {
      if (!buf || !this.ctx || this.amb || !this.wantAmb || !this.master) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0;
      this.ambGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
      src.connect(this.ambGain);
      this.ambGain.connect(this.master);
      src.start();
      this.amb = src;
    });
  }

  stopAmbience() {
    this.wantAmb = false;
    if (this.amb) {
      try {
        this.amb.stop();
      } catch {
        /* already stopped */
      }
      this.amb = null;
    }
  }
}

export const skySound = new DistrictSound();

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => skySound.stopAmbience());
  document.addEventListener("visibilitychange", () => skySound.setPaused(document.hidden));
}
