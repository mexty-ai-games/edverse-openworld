"""Original sounds for Idea Grove, synthesised from scratch with numpy, encoded to MP3 with ffmpeg.
python3 sounds.py <out_dir>
- grove_ambience.mp3: 24 s seamless loop: soft wind in leaves + synthetic bird chirps + a few crickets.
- chime.mp3 (lantern / discovery), pop.mp3 (phrase bubble), success.mp3 (constellation found / done)."""
import os
import subprocess
import sys

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/audio"
os.makedirs(OUT, exist_ok=True)
SR = 44100
rng = np.random.default_rng(3)


def write(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.85
    raw = os.path.join(OUT, name + ".f32")
    x.astype(np.float32).tofile(raw)
    dst = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
                    "-codec:a", "libmp3lame", "-b:a", "96k", dst], check=True)
    os.remove(raw)
    print("wrote", dst, os.path.getsize(dst))


def lowpass(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def periodic_noise(n, lo, hi):
    """Band-limited noise that loops perfectly (built in the frequency domain)."""
    spec = np.zeros(n // 2 + 1, complex)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f > lo) & (f < hi)
    spec[band] = (rng.standard_normal(band.sum()) + 1j * rng.standard_normal(band.sum())) / np.sqrt(f[band])
    return np.fft.irfft(spec, n)


def ambience(sec=24):
    n = SR * sec
    t = np.arange(n) / SR
    wind = periodic_noise(n, 80, 1400)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * t / sec * 2 + 1) * np.sin(2 * np.pi * t / sec * 3)
    leaves = periodic_noise(n, 2500, 7000) * (0.3 + 0.7 * np.clip(gust, 0, 1) ** 2)
    x = wind / np.std(wind) * 0.18 * gust + leaves / np.std(leaves) * 0.03
    # birds: short FM chirps, wrapped around the loop end so it stays seamless
    for _ in range(26):
        start = rng.uniform(0, sec)
        notes = rng.integers(2, 6)
        base = rng.uniform(2600, 4200)
        for k in range(notes):
            d = rng.uniform(0.06, 0.14)
            st = start + k * (d + rng.uniform(0.02, 0.08))
            m = int(d * SR)
            tt = np.arange(m) / SR
            f0 = base * rng.uniform(0.9, 1.15)
            sweep = f0 + rng.uniform(-900, 900) * tt / d
            ph = 2 * np.pi * np.cumsum(sweep) / SR + 0.8 * np.sin(2 * np.pi * 38 * tt)
            env = np.sin(np.pi * tt / d) ** 2
            chirp = np.sin(ph) * env * rng.uniform(0.05, 0.12)
            i0 = int(st * SR)
            idx = (np.arange(m) + i0) % n
            x[idx] += chirp
    # crickets far away
    for _ in range(4):
        st = rng.uniform(0, sec)
        m = int(SR * 1.6)
        tt = np.arange(m) / SR
        tr = (np.sin(2 * np.pi * 28 * tt) > 0.3).astype(float)
        c = np.sin(2 * np.pi * 4700 * tt) * tr * np.sin(np.pi * tt / 1.6) * 0.02
        idx = (np.arange(m) + int(st * SR)) % n
        x[idx] += c
    write("grove_ambience", x)


def tone(freqs, dur, decay, partials=(1, 2.01, 3.0), amps=(1, 0.35, 0.15)):
    t = np.arange(int(SR * dur)) / SR
    x = np.zeros_like(t)
    for i, f in enumerate(freqs):
        st = i * 0.09
        tt = np.clip(t - st, 0, None)
        on = t >= st
        for p, a in zip(partials, amps):
            x += on * np.sin(2 * np.pi * f * p * tt) * a * np.exp(-tt * decay)
    return x * np.minimum(1, t * 400)


write("chime", tone([1046.5, 1318.5, 1568.0], 1.4, 3.2))
pt = np.arange(int(SR * 0.18)) / SR
write("pop", np.sin(2 * np.pi * (520 + 900 * pt / 0.18) * pt) * np.exp(-pt * 26) * np.minimum(1, pt * 600))
write("success", tone([784.0, 987.8, 1174.7, 1568.0], 1.8, 2.6))
ambience()
