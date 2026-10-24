"""Chrono Quarter dusk ambience, synthesised from scratch with numpy, encoded with ffmpeg.
python3 sounds.py <out_dir>
- chrono_ambience.mp3: 30 s seamless loop: a fountain's trickle, warm evening wind, crickets and a few
  soft wind-chime notes (pentatonic). Uses the Idea Grove's own helpers (../sounds.py)."""
import os
import sys

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/audio"
sys.argv = [sys.argv[0], OUT]
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sounds as G  # noqa: E402

SR = G.SR
rng = np.random.default_rng(17)
N = SR * 30
t = np.arange(N) / SR


def loop_env(period, phase=0.0):
    return 0.5 + 0.5 * np.sin(2 * np.pi * (t / period + phase))


# fountain: bright band noise, gently modulated, with tiny droplet blips
water = G.periodic_noise(N, 900, 6000) * (0.75 + 0.25 * loop_env(3.0)) * 0.45
drops = np.zeros(N)
for k in range(260):
    i = rng.integers(0, N - 2000)
    f = rng.uniform(900, 2400)
    n = np.arange(1500)
    drops[i:i + 1500] += np.sin(2 * np.pi * f * (1 + n / 1500 * 0.6) * n / SR) * np.exp(-n / 220) * rng.uniform(0.05, 0.15)
wind = G.periodic_noise(N, 80, 700) * (0.5 + 0.5 * loop_env(15.0)) * 0.5
# crickets: chirps of a 4.3 kHz tone in pulses of three
crick = np.zeros(N)
for k in range(70):
    i = rng.integers(0, N - SR)
    f = rng.uniform(4000, 4600)
    for p in range(3):
        n = np.arange(int(0.03 * SR))
        s = i + int(p * 0.06 * SR)
        crick[s:s + len(n)] += np.sin(2 * np.pi * f * n / SR) * np.sin(np.pi * n / len(n)) * 0.07
# wind chimes: pentatonic bell partials, sparse
chime = np.zeros(N)
notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]
for k in range(9):
    i = int(rng.uniform(0.5, 28) * SR)
    f = notes[rng.integers(0, len(notes))]
    n = np.arange(int(3.5 * SR))
    env = np.exp(-n / (0.9 * SR))
    tone = (np.sin(2 * np.pi * f * n / SR) + 0.4 * np.sin(2 * np.pi * f * 2.76 * n / SR) + 0.2 * np.sin(2 * np.pi * f * 5.4 * n / SR)) * env * 0.16
    end = min(N, i + len(n))
    chime[i:end] += tone[:end - i]
    if i + len(n) > N:  # wrap so the loop stays seamless
        chime[:i + len(n) - N] += tone[end - i:]
mix = water + drops + wind + crick + chime
G.write("chrono_ambience", mix * 0.9)
