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
  private ambUrl = "";
  /** A district's own loop while the explorer is inside it (empty: the grove's). */
  private ambOverride = "";
  private voiceGain: GainNode | null = null;
  private voiceSrc: AudioBufferSourceNode | null = null;
  private voiceQueue: string[] = [];
  private voiceSeq = 0;
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
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = 1;
      this.voiceGain.connect(this.master);
      this.apply();
      this.preload();
    }
    if (this.ctx.state === "suspended" && !this.suspended) this.ctx.resume().catch(() => undefined);
    if (this.wantAmb && !this.amb) this.startAmbience();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      this.voiceQueue = [];
      this.stopVoice();
    }
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
    [this.ambOverride || this.urls.ambience, this.urls.chime, this.urls.pop, this.urls.success].forEach((u) => u && this.load(u));
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

  /** The Field Camera's shutter: a prop sound if there is one, else a soft two-part click made here. */
  shutter(url?: string) {
    if (!this.ctx || this.muted) return;
    const buf = url ? this.buffers.get(url) : undefined;
    if (url && !buf) this.load(url);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.sfxGain!);
      src.start();
      return;
    }
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.12);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      // two clicks (shutter opens, closes), each a fast-decaying burst
      const env = Math.exp(-t * 90) + (t > 0.055 ? 0.7 * Math.exp(-(t - 0.055) * 110) : 0);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain!);
    src.start();
  }

  startAmbience() {
    this.wantAmb = true;
    const url = this.ambOverride || this.urls.ambience;
    if (!this.ctx || this.amb || !url) return;
    this.load(url).then((buf) => {
      if (!buf || !this.ctx || this.amb || !this.wantAmb || (this.ambOverride || this.urls.ambience) !== url) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.ambGain!);
      src.start();
      this.amb = src;
      this.ambUrl = url;
    });
  }

  /** Swap the ambience loop: a district's own while inside it, the grove's ("") back home. */
  setAmbience(url: string) {
    if (url === this.ambOverride) return;
    this.ambOverride = url;
    const want = this.wantAmb;
    if (this.amb && this.ambUrl === (url || this.urls.ambience)) return;
    this.stopLoop();
    if (want) this.startAmbience();
  }

  /** Voice-over: plays one line after another (a new call with `interrupt` replaces what is playing). */
  voice(urls: string[], interrupt = true) {
    const list = urls.filter(Boolean);
    if (!list.length) return;
    if (interrupt) {
      this.voiceQueue = [];
      this.stopVoice();
    }
    this.voiceQueue.push(...list);
    if (!this.voiceSrc) this.nextVoice();
  }

  stopVoice() {
    this.voiceSeq++;
    if (this.voiceSrc) {
      try {
        this.voiceSrc.stop();
      } catch {
        /* already stopped */
      }
      this.voiceSrc = null;
    }
    this.duck(false);
  }

  private nextVoice() {
    const url = this.voiceQueue.shift();
    if (!url || !this.ctx) {
      this.duck(false);
      return;
    }
    const seq = ++this.voiceSeq;
    this.load(url).then((buf) => {
      if (seq !== this.voiceSeq || !this.ctx) return;
      if (!buf || this.muted) {
        this.nextVoice();
        return;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.voiceGain!);
      src.onended = () => {
        if (this.voiceSrc !== src) return;
        this.voiceSrc = null;
        this.nextVoice();
      };
      this.duck(true);
      src.start();
      this.voiceSrc = src;
    });
  }

  /** The ambience goes quieter while a voice line plays. */
  private duck(on: boolean) {
    if (this.ambGain && this.ctx) this.ambGain.gain.setTargetAtTime(on ? 0.16 : 0.45, this.ctx.currentTime, 0.12);
  }

  private stopLoop() {
    if (this.amb) {
      try {
        this.amb.stop();
      } catch {
        /* already stopped */
      }
      this.amb = null;
    }
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
