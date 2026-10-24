"""Biome Frontier ambience: a seamless 24 s loop of a distant waterfall, slow sea swells and soft
birdsong, synthesised from scratch with numpy, encoded with ffmpeg.  python3 sounds.py <out_dir>"""
import math
import os
import subprocess
import sys
import wave

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/audio"
os.makedirs(OUT, exist_ok=True)
SR = 44100
D = 24.0
N = int(SR * D)
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def lp(x, cutoff):
    # fast FFT low-pass on a periodic signal: seamless by construction
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def bp(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (f / hi) ** 4)) * (1 - 1 / (1 + (f / lo) ** 4))
    return np.fft.irfft(X, len(x))


white = rng.standard_normal(N)
# waterfall: steady pink-ish rush, a little flutter
fall = lp(white, 900) * 0.6 + bp(rng.standard_normal(N), 900, 4000) * 0.12
fall *= 1 + 0.08 * np.sin(2 * math.pi * t * 0.5)
# sea swells: 4 waves per loop (periodic), each a rising hiss and a soft fall
env = np.clip(np.sin(2 * math.pi * t * 4 / D - 1.2) * 0.5 + 0.5, 0, 1) ** 2.2
sea = bp(rng.standard_normal(N), 200, 2500) * env * 0.9
# birds: short chirp phrases at loop-safe times
birds = np.zeros(N)
for start, base, n in ((2.1, 2600, 3), (6.8, 3400, 4), (11.3, 2200, 2), (15.9, 3000, 5), (19.4, 2800, 3), (22.0, 3600, 2)):
    for j in range(n):
        s0 = int((start + j * 0.16) * SR)
        L = int(0.11 * SR)
        tt = np.arange(L) / SR
        f = base * (1 + 0.35 * np.sin(np.pi * tt / 0.11)) + 300 * j
        ph = 2 * np.pi * np.cumsum(f) / SR
        e = np.sin(np.pi * tt / 0.11) ** 2
        birds[s0:s0 + L] += np.sin(ph) * e * 0.18
mix = fall / np.abs(fall).max() * 0.35 + sea / np.abs(sea).max() * 0.35 + birds
mix /= np.abs(mix).max() * 1.15
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], -1)
wav = os.path.join(OUT, "bf_ambience.wav")
with wave.open(wav, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
mp3 = os.path.join(OUT, "bf_ambience.mp3")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "96k", mp3], check=True)
os.remove(wav)
print("wrote", mp3, os.path.getsize(mp3))
