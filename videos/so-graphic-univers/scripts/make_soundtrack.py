#!/usr/bin/env python3
"""Bande-son de « So Graphic — Je change d'univers » (15 s, 120 BPM, la mineur → do majeur).

Musique synthétisée en numpy (aucune dépendance hors numpy + ffmpeg) et calée
sur les mêmes temps que index.html ; bruitages Pixabay copiés dans assets/sfx.

    python3 scripts/make_soundtrack.py      # écrit assets/audio/soundtrack.wav
"""
import os
import subprocess
import wave

import numpy as np

SR = 48000
DUR = 15.0
N = int(SR * DUR)
PAD = SR * 4  # place pour les queues de réverb
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SFX_DIR = os.path.join(ROOT, "assets", "sfx")
OUT = os.path.join(ROOT, "assets", "audio", "soundtrack.wav")

rng = np.random.default_rng(20261012)
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(s):
    """'A4' / 'C#5' / 'Bb3' → Hz."""
    acc = 0
    i = 1
    if s[1:2] == "#":
        acc, i = 1, 2
    elif s[1:2] == "b":
        acc, i = -1, 2
    midi = 12 * (int(s[i:]) + 1) + NOTE[s[0]] + acc
    return 440.0 * 2 ** ((midi - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


# ---------------------------------------------------------------- filters
def fft_filter(x, lp=None, hp=None, order=2):
    """Zero-phase Butterworth-shaped magnitude filter (mono or stereo)."""
    n = x.shape[-1]
    X = np.fft.rfft(x, axis=-1)
    f = np.fft.rfftfreq(n, 1 / SR)
    H = np.ones_like(f)
    if lp:
        H *= 1 / np.sqrt(1 + (f / lp) ** (2 * order))
    if hp:
        with np.errstate(divide="ignore"):
            H *= 1 / np.sqrt(1 + (hp / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, n=n, axis=-1)


def swept_noise(dur, fc, bw=0.6, seed=None):
    """Band-passed noise whose centre follows fc(t) (Hz). STFT overlap-add."""
    g = np.random.default_rng(seed) if seed is not None else rng
    n = int(dur * SR)
    x = g.standard_normal(n + 4096)
    frame, hop = 2048, 512
    win = np.hanning(frame)
    out = np.zeros(n + 4096)
    norm = np.zeros(n + 4096)
    f = np.fft.rfftfreq(frame, 1 / SR)
    lf = np.log2(np.maximum(f, 1.0))
    for s in range(0, n, hop):
        seg = x[s : s + frame] * win
        c = max(40.0, fc((s + frame / 2) / SR))
        mask = np.exp(-0.5 * ((lf - np.log2(c)) / bw) ** 2)
        out[s : s + frame] += np.fft.irfft(np.fft.rfft(seg) * mask, n=frame) * win
        norm[s : s + frame] += win**2
    y = out[:n] / np.maximum(norm[:n], 1e-3)
    return y / (np.abs(y).max() + 1e-9)


# ---------------------------------------------------------------- voices
def pluck(f, dur=1.4, tau=0.55, bright=0.62, partials=14, inharm=0.0004):
    t = tt(dur)
    s = np.zeros_like(t)
    for k in range(1, partials + 1):
        fk = f * k * (1 + inharm * k * k)
        if fk > SR / 2.3:
            break
        amp = bright ** (k - 1) / k**0.6
        s += amp * np.sin(2 * np.pi * fk * t + 0.4 * k) * np.exp(-t / (tau / (1 + 0.55 * (k - 1))))
    s *= np.minimum(1, t / 0.002)
    s += fft_filter(rng.standard_normal(len(t)) * np.exp(-t / 0.003), hp=2500) * 0.05
    return s / (np.abs(s).max() + 1e-9)


def bell(f, dur=2.4, tau=1.1, glass=False):
    t = tt(dur)
    ratios = [1, 2.76, 5.40, 8.93] if glass else [1, 2.0, 3.01, 4.17, 5.43, 6.79]
    amps = [1, 0.45, 0.25, 0.12] if glass else [1, 0.55, 0.32, 0.22, 0.12, 0.08]
    s = np.zeros_like(t)
    for i, (r, a) in enumerate(zip(ratios, amps)):
        if f * r < SR / 2.3:
            s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau / (1 + 0.9 * i)))
    s *= np.minimum(1, t / 0.0015)
    return s / (np.abs(s).max() + 1e-9)


def saw(f, n, phase0=0.0):
    dt = f / SR
    ph = (phase0 + np.cumsum(np.full(n, dt))) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def pad(notes, dur, att=0.45, rel=0.5, lp=1400, detune=0.006):
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for note in notes:
        f = hz(note)
        for j, d in enumerate((-detune, 0.0, detune)):
            v = saw(f * (1 + d), n, rng.random())
            if j == 0:
                L += v
            elif j == 2:
                R += v
            else:
                L += 0.6 * v
                R += 0.6 * v
    st = fft_filter(np.vstack([L, R]), lp=lp, order=2)
    t = np.arange(n) / SR
    env = np.minimum(1, t / att) * np.clip((dur - t) / rel, 0, 1)
    env = env**1.5
    st *= env
    return st / (np.abs(st).max() + 1e-9)


def stab(notes, dur=0.7, decay=0.16):
    t = tt(dur)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for note in notes:
        f = hz(note)
        for side, d in ((0, -0.005), (1, 0.005)):
            v = np.zeros_like(t)
            for k in range(1, 40):
                fk = f * (1 + d) * k
                if fk > SR / 2.3:
                    break
                # filtre qui se referme : les harmoniques aiguës meurent plus vite
                v += (1 / k) * np.sin(2 * np.pi * fk * t + k) * np.exp(-t / (decay / (1 + 0.18 * (k - 1))))
            (L if side == 0 else R)[:] += v
    st = np.vstack([L, R]) * np.minimum(1, t / 0.002)
    return st / (np.abs(st).max() + 1e-9)


def kick(f0=165, f1=46, pdec=0.038, adec=0.3, dur=0.6):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / pdec)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / adec) * np.minimum(1, t / 0.0015)
    click = fft_filter(rng.standard_normal(len(t)) * np.exp(-t / 0.0025), hp=1800) * 0.3
    s = np.tanh(1.8 * (s + click)) / np.tanh(1.8)
    return s


def clap(dur=0.45, tail=0.13):
    t = tt(dur)
    e = np.zeros_like(t)
    for d in (0.0, 0.011, 0.023):
        e += np.where(t >= d, np.exp(-(t - d) / 0.005), 0)
    e += np.where(t > 0.028, 0.75 * np.exp(-(t - 0.028) / tail), 0)
    s = fft_filter(rng.standard_normal(len(t)), hp=900, lp=6000) * e
    return s / (np.abs(s).max() + 1e-9)


def snare(dur=0.25):
    t = tt(dur)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    nz = fft_filter(rng.standard_normal(len(t)), hp=1200, lp=9000) * np.exp(-t / 0.07)
    s = 0.5 * tone + nz
    return s / (np.abs(s).max() + 1e-9)


def hat(open_=False):
    dur = 0.5 if open_ else 0.12
    t = tt(dur)
    s = fft_filter(rng.standard_normal(len(t)), hp=7500) * np.exp(-t / (0.2 if open_ else 0.03))
    return s / (np.abs(s).max() + 1e-9)


def sub(f, dur, att=0.01, rel=0.06):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / att) * np.clip((dur - t) / rel, 0, 1)
    return np.tanh(1.4 * s * env) / np.tanh(1.4)


def boom(f0=72, f1=30, dur=1.6, adec=0.7):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / adec) * np.minimum(1, t / 0.002)
    crash = fft_filter(rng.standard_normal(len(t)), lp=7000, hp=300) * np.exp(-t / 0.45) * 0.35
    s = np.tanh(1.5 * (s + crash)) / np.tanh(1.5)
    return s


def tick(f=2600, dur=0.03, noise=0.6):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004)
    s += noise * fft_filter(rng.standard_normal(len(t)), hp=2000) * np.exp(-t / 0.0025)
    return s / (np.abs(s).max() + 1e-9)


def plop(f0=900, f1=260, dur=0.12):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.012)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * np.minimum(1, t / 0.001)
    return s


def marimba(f, dur=0.5):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.09) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.025)
    return s * np.minimum(1, t / 0.001)


def marker(dur=0.18):
    s = swept_noise(dur, lambda u: 1400 + 3000 * u / dur, bw=0.35)
    t = tt(dur)
    env = np.minimum(1, t / 0.01) * np.exp(-np.maximum(0, t - 0.1) / 0.03)
    return s[: len(t)] * env


def riser(dur, f_from=300, f_to=9000, power=2.2, bw=0.5, seed=None):
    s = swept_noise(dur, lambda u: f_from * (f_to / f_from) ** (u / dur), bw=bw, seed=seed)
    t = tt(dur)
    return s[: len(t)] * (t / dur) ** power


def load_sfx(name, start=0.0, end=None):
    """Décode un SFX (mp3) en stéréo float 48 kHz via ffmpeg."""
    path = os.path.join(SFX_DIR, name)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(np.float64)
    a = int(start * SR)
    b = x.shape[1] if end is None else int(end * SR)
    return x[:, a:b]


# ---------------------------------------------------------------- buses
class Bus:
    def __init__(self):
        self.dry = np.zeros((2, N + PAD))
        self.wet = np.zeros((2, N + PAD))
        self.duck = np.zeros((2, N + PAD))  # sidechained to the kick

    def add(self, sig, t, gain=1.0, pan=0.0, send=0.0, duck=False):
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
        sig = sig * gain
        i = int(round(t * SR))
        if i < 0:
            sig = sig[:, -i:]
            i = 0
        j = min(i + sig.shape[1], N + PAD)
        target = self.duck if duck else self.dry
        target[:, i:j] += sig[:, : j - i]
        if send:
            self.wet[:, i:j] += sig[:, : j - i] * send


def make_ir(rt=2.2, dur=2.8, seed=3):
    g = np.random.default_rng(seed)
    t = tt(dur)
    ir = []
    for ch in range(2):
        x = g.standard_normal(len(t))
        lo = fft_filter(x, lp=400) * np.exp(-6.9 * t / (rt * 1.15))
        mid = fft_filter(x, hp=400, lp=4000) * np.exp(-6.9 * t / rt)
        hi = fft_filter(x, hp=4000) * np.exp(-6.9 * t / (rt * 0.4))
        y = lo + mid + 0.6 * hi
        y *= np.minimum(1, t / 0.006)
        pre = np.zeros(int(0.018 * SR))
        ir.append(np.concatenate([pre, y]))
    ir = np.vstack(ir)
    return ir / np.sqrt((ir**2).sum() / 2)


IR = make_ir()


def convolve(x, ir):
    n = x.shape[1] + ir.shape[1]
    m = 1 << int(np.ceil(np.log2(n)))
    out = np.fft.irfft(np.fft.rfft(x, m, axis=-1) * np.fft.rfft(ir, m, axis=-1), m, axis=-1)
    return out[:, : x.shape[1]]


def sidechain(kicks, depth=0.72, rel=0.16):
    g = np.ones(N + PAD)
    t = np.arange(N + PAD) / SR
    for k in kicks:
        m = t >= k
        d = t[m] - k
        g[m] = np.minimum(g[m], 1 - depth * np.exp(-d / rel) * np.minimum(1, d / 0.004 + 0.2))
    return g


def render(bus, kicks, rev=1.0):
    sc = sidechain(kicks)
    mix = bus.dry + bus.duck * sc
    mix = mix + convolve(bus.wet, IR) * rev
    return mix


# ================================================================= SCORE
music_a = Bus()  # 0 → 4.0 (s'arrête net : tape stop)
music_b = Bus()  # 5.0 → 11.0 (coupé net quand le rouge remplit l'écran)
music_c = Bus()  # 11.5 → 15 (logo)
fx = Bus()

# ---------- A · la question (0 → 3.7) ----------
kicks_a = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5]
for k in kicks_a:
    music_a.add(kick(), k, gain=0.62)
for c in (1.5, 2.5, 3.5):
    music_a.add(clap(), c, gain=0.2, pan=0.05, send=0.35)
for i in range(4, 30):
    t = i * 0.125
    off = (i % 4) == 2
    music_a.add(hat(), t, gain=0.16 if off else 0.06, pan=0.3)
music_a.add(pad(["A3", "C4", "E4", "G4", "B4"], 1.25, att=0.7, rel=0.3, lp=1100), 0.0, gain=0.14, duck=True, send=0.3)
music_a.add(pad(["F3", "A3", "C4", "E4", "G4"], 2.15, att=0.12, rel=0.25, lp=1300), 0.95, gain=0.14, duck=True, send=0.3)
music_a.add(pad(["A3", "C4", "E4", "G4", "B4"], 1.3, att=0.12, rel=0.2, lp=1500), 2.95, gain=0.14, duck=True, send=0.3)
music_a.add(sub(hz("A1"), 0.5, att=0.2), 0.5, gain=0.26, duck=True)
music_a.add(sub(hz("F1"), 2.0), 1.0, gain=0.29, duck=True)
music_a.add(sub(hz("A1"), 1.2), 3.0, gain=0.29, duck=True)
music_a.add(riser(1.0, 600, 5000, power=2.5, seed=11), 0.0, gain=0.05, send=0.4)
s1_words = [
    (0.125, "E5"), (0.25, "A4"), (0.5, "C5"), (0.75, "B4"), (1.0, "A4"),
    (1.25, "C5"), (1.375, "E5"), (1.5, "G5"), (2.0, "F5"), (2.125, "E5"),
    (2.5, "C5"), (2.625, "A4"), (2.875, "B4"), (3.0, "C5"),
]
for i, (t, nt) in enumerate(s1_words):
    music_a.add(pluck(hz(nt)), t, gain=0.2, pan=(-0.3 if i % 2 else 0.3), send=0.35)
music_a.add(bell(hz("G5"), glass=True), 1.5, gain=0.13, pan=0.2, send=0.6)  # « brief »
music_a.add(bell(hz("A5"), glass=True), 3.25, gain=0.16, pan=-0.1, send=0.6)  # point rouge
music_a.add(bell(hz("E6"), glass=True, tau=0.8), 3.25, gain=0.07, pan=0.3, send=0.6)

# ---------- B · moi non plus (silence) — bruitages ----------
for t, nt in ((4.066, "G4"), (4.2, "E4"), (4.333, "C4")):
    fx.add(marimba(hz(nt)), t, gain=0.32, send=0.15)
# rebonds du point rouge (bounce.out : contacts à 36 %, 73 %, 91 %, 100 % de 0,34 s)
for k, (p, g) in enumerate(((0.3636, 0.5), (0.7273, 0.24), (0.9091, 0.12), (1.0, 0.06))):
    fx.add(plop(900 + 120 * k, 260 + 40 * k), 4.44 + 0.34 * p, gain=g, send=0.1)
fx.add(riser(0.18, 2000, 7000, power=1.5, seed=5), 4.82, gain=0.08)

# ---------- C · je ne change pas de métier (5.0 → 7.0) ----------
kicks_b = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0]
kicks_c = [12.0, 13.0, 14.0]
for k in kicks_b[:4]:
    music_b.add(kick(), k, gain=0.7)
music_b.add(clap(), 5.5, gain=0.22, send=0.35)
roll = [6.0, 6.25, 6.5, 6.625, 6.75, 6.8125, 6.875, 6.9375]
for i, t in enumerate(roll):
    music_b.add(snare(), t, gain=0.1 + 0.05 * i, pan=-0.1, send=0.25)
for i in range(40, 54):
    t = i * 0.125
    music_b.add(hat(), t, gain=0.05 + 0.006 * (i - 40), pan=0.3)
music_b.add(pad(["F3", "A3", "C4", "E4", "G4"], 1.05, att=0.06, rel=0.1, lp=1300), 5.0, gain=0.14, duck=True, send=0.3)
music_b.add(pad(["G3", "B3", "D4", "E4", "A4"], 0.95, att=0.05, rel=0.15, lp=2400), 6.0, gain=0.15, duck=True, send=0.3)
for i in range(6):
    music_b.add(sub(hz("F1"), 0.2), 5.0 + i * 0.25, gain=0.26, duck=True)
for i in range(3):
    music_b.add(sub(hz("G1"), 0.2), 6.0 + i * 0.25, gain=0.27, duck=True)
for t, nt in ((5.0, "F4"), (5.125, "A4"), (5.25, "C5"), (5.5, "A4"), (5.625, "C5"), (5.75, "F5")):
    music_b.add(pluck(hz(nt)), t, gain=0.2, pan=0.2 if nt.endswith("5") else -0.2, send=0.35)
music_b.add(bell(hz("D5"), glass=True), 6.0, gain=0.13, send=0.6)
music_b.add(bell(hz("G5"), glass=True), 6.0, gain=0.08, pan=0.3, send=0.6)
fx.add(riser(2.0, 300, 9000, power=2.4, seed=21), 5.0, gain=0.22, send=0.3)
rise_t = tt(2.0)
rise_f = 220 * 4 ** (rise_t / 2.0)
rise_tone = fft_filter(np.sin(2 * np.pi * np.cumsum(rise_f) / SR) * (rise_t / 2.0) ** 2, lp=3000)
fx.add(rise_tone, 5.0, gain=0.05, send=0.4)
fx.add(marker(), 6.25, gain=0.32, pan=-0.2)
fx.add(marker(), 6.5, gain=0.32, pan=0.15)
rev_cym = fft_filter(rng.standard_normal(int(0.7 * SR)), hp=3000) * (tt(0.7) / 0.7) ** 3
fx.add(rev_cym, 6.3, gain=0.22, send=0.2)

# ---------- D · DROP · je change d'univers (7.0 → 11.0) ----------
fx.add(boom(), 7.0, gain=0.75, send=0.35)
for k in kicks_b[4:11]:
    music_b.add(kick(), k, gain=0.95)
for c in (7.5, 8.5, 9.5):
    music_b.add(clap(), c, gain=0.3, send=0.35)
for t in (7.25, 7.75, 8.75, 9.25, 9.75, 10.25):
    music_b.add(hat(True), t, gain=0.12, pan=0.25, send=0.1)
for i in range(56, 84):
    music_b.add(hat(), i * 0.125, gain=0.07 if i % 2 else 0.04, pan=-0.25)
chords = [
    (7.0, 1.25, ["A3", "C4", "E4", "A4"], "A1"),
    (8.25, 0.75, ["F3", "A3", "C4", "E4"], "F1"),
    (9.0, 0.75, ["G3", "C4", "E4", "B4"], "C2"),
    (9.75, 0.75, ["G3", "B3", "D4", "A4"], "G1"),
]
for t0, d, notes, root in chords:
    music_b.add(pad(notes, d + 0.08, att=0.03, rel=0.1, lp=2600), t0, gain=0.13, duck=True, send=0.25)
    music_b.add(sub(hz(root), d), t0, gain=0.34, duck=True)
for t0, notes in ((7.0, ["A3", "C4", "E4", "A4"]), (7.5, ["A3", "C4", "E4", "G4"]), (8.25, ["F3", "A3", "C4", "E4"]), (9.0, ["G3", "C4", "E4", "B4"]), (9.75, ["G3", "B3", "D4", "A4"])):
    music_b.add(stab(notes), t0, gain=0.2, send=0.45)
# U1 · IA : glitch + blips + frappe du prompt
fx.add(load_sfx("glitch-1.mp3", 0.15, 0.62), 7.48, gain=0.22, send=0.1)
pent = ["A5", "C6", "D6", "E6", "G6", "A6", "C7"]
for i in range(10):
    f = hz(pent[int(rng.integers(len(pent)))])
    fx.add(bell(f, dur=0.25, tau=0.08, glass=True), 7.5 + i * 0.031, gain=0.05 * (1 - i / 12), pan=float(rng.uniform(-0.7, 0.7)), send=0.4)
for i in range(0, 27, 2):
    fx.add(tick(3200, noise=0.8), 7.6 + i * 0.016, gain=0.06, pan=-0.2)
for i, t in enumerate((7.6, 7.67, 7.74)):
    fx.add(bell(hz(["E7", "B6", "G7"][i]), dur=0.6, tau=0.2, glass=True), t, gain=0.05, pan=[0.5, 0.6, -0.6][i], send=0.5)
# U2 · communication visuelle : tampon + lignes qui glissent
st_t = tt(0.25)
stamp = np.sin(2 * np.pi * np.cumsum(60 + 70 * np.exp(-st_t / 0.03)) / SR) * np.exp(-st_t / 0.07)
stamp += fft_filter(rng.standard_normal(len(st_t)), lp=2500) * np.exp(-st_t / 0.012) * 0.5
fx.add(stamp, 8.25, gain=0.55, send=0.12)
for i in range(4):
    fx.add(riser(0.16, 1200, 5000, power=0.6, seed=40 + i), 8.27 + i * 0.045, gain=0.06, pan=(-0.6 if i % 2 == 0 else 0.6))
# U3 · direction artistique : glissando « harpe » + souffle
for i, nt in enumerate(["C5", "E5", "G5", "B5", "D6", "E6", "G6", "B6"]):
    fx.add(pluck(hz(nt), dur=1.2, tau=0.6, bright=0.5), 9.0 + i * 0.032, gain=0.09, pan=-0.5 + i * 0.13, send=0.6)
fx.add(riser(0.45, 4000, 900, power=0.4, bw=0.8, seed=60), 8.95, gain=0.08, send=0.4)
# U4 · suivi de projet : frappe, clics, cases cochées, sonnette
for i in range(9):
    fx.add(tick(2200, noise=1.0), 9.76 + i * 0.014, gain=0.05, pan=-0.2)
for i in range(9):
    fx.add(tick(1900 + 40 * i, noise=1.0), 9.88 + i * 0.03, gain=0.09, pan=-0.1 + 0.02 * i)
for i in range(4):
    fx.add(riser(0.2, 500, 3500, power=0.8, seed=70 + i), 9.86 + i * 0.1, gain=0.04, pan=0.3)
for t in (10.05, 10.06, 10.16, 10.26, 10.36):
    fx.add(tick(3800, dur=0.02, noise=0.3), t, gain=0.08, pan=0.35)
fx.add(bell(hz("A6"), dur=1.5, tau=0.5), 10.2, gain=0.1, pan=0.2, send=0.4)
# 10.5 → 11.0 · l'iris envahit l'écran
for i, t in enumerate((10.5, 10.625, 10.75, 10.8125, 10.875, 10.9375)):
    music_b.add(snare(), t, gain=0.14 + 0.05 * i, send=0.25)
music_b.add(pad(["G3", "B3", "D4", "E4", "A4"], 0.55, att=0.05, rel=0.02, lp=4000), 10.5, gain=0.14, send=0.25)
music_b.add(sub(hz("G1"), 0.5, rel=0.01), 10.5, gain=0.32)
whoosh = load_sfx("whoosh-cinematic.mp3", 1.6, 2.6)  # pic à 2,54 s → 10,95 s
wt = np.arange(whoosh.shape[1]) / SR
whoosh *= np.clip((2.6 - 1.6 - wt) / 0.06, 0, 1)
fx.add(whoosh, 10.95 - (2.54 - 1.6), gain=0.7)
fx.add(riser(0.5, 800, 12000, power=2.0, seed=81), 10.5, gain=0.32)

# ---------- E · LOGO (11.0 → 15.0) ----------
# 11.0 → 11.5 : aspiration du rouge
vac = swept_noise(0.5, lambda u: 7000 * (300 / 7000) ** (u / 0.5), bw=0.7, seed=90)
vt = tt(0.5)
fx.add(vac[: len(vt)] * (vt / 0.5) ** 1.5, 11.0, gain=0.16, send=0.2)
fx.add(sub(32, 0.5, att=0.45, rel=0.02), 11.0, gain=0.24)
# 11.5 : impact, onde de choc
fx.add(load_sfx("impact-bass-1.mp3"), 11.5 - 0.05, gain=0.55)
fx.add(boom(f0=80, f1=34, dur=1.8, adec=0.9), 11.5, gain=0.45, send=0.4)
for i, nt in enumerate(["C6", "G6", "E7"]):
    fx.add(bell(hz(nt), dur=2.4, tau=1.0, glass=True), 11.5, gain=0.06, pan=[-0.4, 0.4, 0][i], send=0.7)
# cliquetis des engrenages, calés sur leur vitesse de rotation (power4.out)


def gear_clicks(t0, dur, r0, r1, step, f, gain, pan):
    ts = np.arange(0, dur, 1 / 2000)
    rot = r0 + (r1 - r0) * (1 - (1 - ts / dur) ** 4)
    idx = np.floor(rot / step)
    hits = np.nonzero(np.diff(idx) != 0)[0]
    vmax = abs(r1 - r0) * 4 / dur
    for h in hits:
        tm = ts[h]
        v = abs(r1 - r0) * 4 * (1 - tm / dur) ** 3 / dur
        g = gain * min(1.0, 0.25 + v / vmax)
        if g < gain * 0.3:
            continue
        fx.add(tick(f, dur=0.025, noise=0.7), t0 + tm, gain=g, pan=pan)


gear_clicks(11.46, 3.54, -300, 35, 15, 1700, 0.07, -0.15)
gear_clicks(11.75, 3.25, 320, -55, 20, 2600, 0.05, 0.4)
fx.add(load_sfx("whoosh.mp3"), 11.62 - 0.09, gain=0.3, pan=-0.2)
fx.add(load_sfx("sparkle.mp3"), 12.0 - 0.02, gain=0.32, pan=0.25, send=0.3)
for i, nt in enumerate(["C5", "E5", "G5", "B5", "D6", "E6", "G6"]):  # g·r·a·p·h·i·c
    fx.add(pluck(hz(nt), dur=1.6, tau=0.7, bright=0.58), 12.0 + i * 0.125, gain=0.16, pan=-0.45 + i * 0.15, send=0.5)
# musique de fin : fa maj9 → do maj9 (la mineur → do majeur : la révélation)
music_c.add(pad(["F3", "A3", "C4", "E4", "G4"], 1.6, att=0.35, rel=0.15, lp=1600), 11.5, gain=0.15, duck=True, send=0.35)
music_c.add(pad(["G3", "C4", "E4", "B4", "D5"], 2.2, att=0.25, rel=0.4, lp=2000), 13.0, gain=0.16, duck=True, send=0.4)
music_c.add(sub(hz("F1"), 1.5, att=0.2), 11.5, gain=0.24, duck=True)
music_c.add(sub(hz("C2"), 2.1, att=0.05, rel=0.5), 13.0, gain=0.27, duck=True)
for k in kicks_c:
    music_c.add(kick(adec=0.35), k, gain=0.55)
for i in range(96, 118):
    music_c.add(hat(), i * 0.125, gain=0.05 if i % 2 else 0.025, pan=0.3)
for t, nt in ((13.0, "G4"), (13.125, "C5"), (13.25, "E5"), (13.375, "G5")):
    fx.add(pluck(hz(nt)), t, gain=0.15, pan=0.0, send=0.45)
# « révèlent » : souffle qui balaie de gauche à droite avec la ligne rouge
rev = swept_noise(0.6, lambda u: 1800 * (3.5) ** (u / 0.6), bw=0.5, seed=99)
rt = tt(0.6)
rev = rev[: len(rt)] * np.sin(np.pi * rt / 0.6) ** 1.5
pan_curve = np.linspace(-0.8, 0.8, len(rt))
a = (pan_curve + 1) * np.pi / 4
fx.add(np.vstack([rev * np.cos(a), rev * np.sin(a)]) * np.sqrt(2), 13.48, gain=0.12, send=0.3)
fx.add(bell(hz("C6"), dur=2.0, tau=0.9), 14.05, gain=0.06, pan=0.5, send=0.6)
fx.add(bell(hz("G6"), dur=2.0, tau=0.9, glass=True), 14.05, gain=0.035, pan=0.6, send=0.6)
# reflet sur « révèlent »
sh_t = tt(0.8)
shimmer = sum(np.sin(2 * np.pi * hz(nt) * sh_t) for nt in ("C7", "E7", "G7", "B7"))
shimmer = shimmer * np.sin(np.pi * sh_t / 0.8) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * sh_t))
a = (np.linspace(-0.7, 0.7, len(sh_t)) + 1) * np.pi / 4
fx.add(np.vstack([shimmer * np.cos(a), shimmer * np.sin(a)]) * np.sqrt(2) / 4, 14.15, gain=0.05, send=0.5)
fx.add(tick(3000, dur=0.02, noise=0.4), 14.25, gain=0.05)

# ================================================================= MIX
mus_a = render(music_a, kicks_a)
# tape stop : la lecture ralentit jusqu'à l'arrêt entre 3,70 et 4,00 s
ts0, ts1 = 3.70, 4.00
i0, i1 = int(ts0 * SR), int(ts1 * SR)
u = np.arange(i1 - i0) / (i1 - i0)
rate = (1 - u) ** 1.4
src = i0 + np.cumsum(rate)
for ch in range(2):
    mus_a[ch, i0:i1] = np.interp(src, np.arange(mus_a.shape[1]), mus_a[ch])
mus_a[:, i0:i1] = fft_filter(mus_a[:, i0:i1], lp=6000)
mus_a[:, i0:i1] *= np.clip((i1 - i0 - np.arange(i1 - i0)) / (0.03 * SR), 0, 1)
mus_a[:, i1:] = 0

mus_b = render(music_b, kicks_b)
mus_b[:, : int(5.0 * SR)] = 0
cut = int(11.0 * SR)
mus_b[:, cut - 480 : cut] *= np.linspace(1, 0, 480)
mus_b[:, cut:] = 0  # silence sous l'aspiration du rouge
mus_c = render(music_c, kicks_c)
fxm = render(fx, [])

mix = mus_a + mus_b + mus_c + fxm
mix = fft_filter(mix[:, :N], hp=28, order=3)

# mastering : normalisation, saturation douce, fondu de fin
mix /= np.percentile(np.abs(mix), 99.97) / 0.8
knee = 0.8
over = np.abs(mix) > knee
mix[over] = np.sign(mix[over]) * (knee + (1 - knee) * np.tanh((np.abs(mix[over]) - knee) / (1 - knee)))
t = np.arange(N) / SR
mix *= np.minimum(1, t / 0.01)
mix *= np.clip((DUR - t) / 0.7, 0, 1) ** 1.2
mix *= 0.94 / np.abs(mix).max()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", OUT, f"{N / SR:.2f}s")
