// Sound: an ambience loop of the grove and a few short effects, all from the game's props.
// One Web Audio engine; silent until the first tap (browser rule); obeys the store's mute and pause.
import type { Sounds } from "./block";

type Sfx = "chime" | "pop" | "success";

function needsLogin(url: string): boolean {
  return /(^|\.)mexty\.ai\/|(^|\.)mext\.app\//.test(url.replace(/^https?:\/\//, ""));
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private urls: Partial<Sounds> = {};
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private amb: AudioBufferSourceNode | null = null;
  private wantAmb = false;
  private muted = false;
  private suspended = false;

  configure(s: Sounds) {
    this.urls = s || {};
    if (this.ctx) this.preload();
  }

  unlock() {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = 0.45;
      this.ambGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);
      this.apply();
      this.preload();
    }
    if (this.ctx.state === "suspended" && !this.suspended) this.ctx.resume().catch(() => undefined);
    if (this.wantAmb && !this.amb) this.startAmbience();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.apply();
  }

  /** Paused by the store (time limit, quiet hours) or the tab is hidden. */
  suspend(on: boolean) {
    this.suspended = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => undefined);
    else this.ctx.resume().catch(() => undefined);
  }

  private apply() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  private preload() {
    [this.urls.ambience, this.urls.chime, this.urls.pop, this.urls.success].forEach((u) => u && this.load(u));
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

  sfx(id: Sfx, vol = 1) {
    if (!this.ctx || this.muted) return;
    const url = this.urls[id];
    const buf = url ? this.buffers.get(url) : undefined;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxGain!);
    src.start();
  }

  startAmbience() {
    this.wantAmb = true;
    const url = this.urls.ambience;
    if (!this.ctx || this.amb || !url) return;
    this.load(url).then((buf) => {
      if (!buf || !this.ctx || this.amb || !this.wantAmb) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.ambGain!);
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

export const sound = new SoundEngine();

// leaving the page stops every sound
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => sound.stopAmbience());
  document.addEventListener("visibilitychange", () => sound.suspend(document.hidden));
}
