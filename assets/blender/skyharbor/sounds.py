"""Original sounds for Skyharbor, synthesised from scratch with numpy and encoded with ffmpeg.

python3 sounds.py <out_dir>
- sh_ambience.mp3: 30 s seamless night loop: high-altitude wind, crickets, a soft airship-hull creak
  and faint glass chimes from the greenhouses.
- sh_beep.mp3: the robot's happy two-note beep (a step done / a part picked up).
- sh_bump.mp3: a soft, friendly "boop" when the robot bumps into something (never harsh).
- sh_whirr.mp3: a short servo whirr for each robot move.
"""
import os
import subprocess
import sys

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", "audio")
os.makedirs(OUT, exist_ok=True)
SR = 44100
rng = np.random.default_rng(17)


def write(name, x, peak=0.85):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    raw = os.path.join(OUT, name + ".f32")
    x.astype(np.float32).tofile(raw)
    dst = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
                    "-codec:a", "libmp3lame", "-b:a", "96k", dst], check=True)
    os.remove(raw)
    print("wrote", dst, os.path.getsize(dst))


def periodic_noise(n, lo, hi):
    spec = np.zeros(n // 2 + 1, complex)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f > lo) & (f < hi)
    spec[band] = (rng.standard_normal(band.sum()) + 1j * rng.standard_normal(band.sum())) / np.sqrt(f[band])
    return np.fft.irfft(spec, n)


def place(x, sig, start):
    n = len(x)
    idx = (np.arange(len(sig)) + int(start * SR)) % n
    x[idx] += sig


def ambience(sec=30):
    n = SR * sec
    t = np.arange(n) / SR
    wind = periodic_noise(n, 60, 900)
    gust = 0.6 + 0.4 * np.sin(2 * np.pi * t / sec * 2 + 0.5) * np.sin(2 * np.pi * t / sec * 3 + 1.0)
    x = wind / np.std(wind) * 0.16 * gust
    # crickets: pulsed trills in two voices, all through the loop
    for voice, (f0, rate) in enumerate(((4300.0, 30.0), (5100.0, 24.0))):
        for _ in range(16):
            d = rng.uniform(0.8, 1.8)
            m = int(SR * d)
            tt = np.arange(m) / SR
            tr = (np.sin(2 * np.pi * rate * tt) > 0.2).astype(float)
            c = np.sin(2 * np.pi * f0 * rng.uniform(0.97, 1.03) * tt) * tr * np.sin(np.pi * tt / d) ** 2 * 0.022
            place(x, c, rng.uniform(0, sec))
    # glass chimes (pentatonic), far and soft
    notes = [1318.5, 1568.0, 1760.0, 2093.0, 2349.3]
    for _ in range(9):
        f = notes[rng.integers(len(notes))]
        m = int(SR * 2.5)
        tt = np.arange(m) / SR
        c = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 2.2) * np.minimum(1, tt * 300) * 0.03
        place(x, c, rng.uniform(0, sec))
    # wooden hull creaks (low, slow)
    for _ in range(4):
        d = rng.uniform(0.5, 0.9)
        m = int(SR * d)
        tt = np.arange(m) / SR
        f = 180 + 60 * np.sin(np.pi * tt / d)
        ph = 2 * np.pi * np.cumsum(f) / SR
        c = np.sign(np.sin(ph)) * 0.3 + np.sin(ph)
        c = np.convolve(c, np.ones(30) / 30, mode="same") * np.sin(np.pi * tt / d) ** 3 * 0.02
        place(x, c, rng.uniform(0, sec))
    write("sh_ambience", x, 0.7)


def beep():
    out = []
    for f, d in ((880.0, 0.08), (1318.5, 0.12)):
        tt = np.arange(int(SR * d)) / SR
        s = np.sign(np.sin(2 * np.pi * f * tt)) * 0.25 + np.sin(2 * np.pi * f * tt)
        s *= np.minimum(1, tt * 500) * np.minimum(1, (d - tt) * 200)
        out.append(s)
        out.append(np.zeros(int(SR * 0.02)))
    write("sh_beep", np.concatenate(out), 0.6)


def bump():
    d = 0.35
    tt = np.arange(int(SR * d)) / SR
    f = 330 - 140 * tt / d
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 9) * np.minimum(1, tt * 400) + 0.25 * np.sin(ph * 2) * np.exp(-tt * 14)
    write("sh_bump", s, 0.6)


def whirr():
    d = 0.28
    tt = np.arange(int(SR * d)) / SR
    f = 240 + 260 * np.sin(np.pi * tt / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.4 * np.sin(ph * 3.01)) * np.sin(np.pi * tt / d) ** 1.5
    s += periodic_noise(len(tt), 2000, 6000)[: len(tt)] * 0.05 * np.sin(np.pi * tt / d)
    write("sh_whirr", s, 0.4)


if __name__ == "__main__":
    ambience()
    beep()
    bump()
    whirr()
