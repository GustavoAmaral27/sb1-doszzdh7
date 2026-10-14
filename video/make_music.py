# Gera a trilha original (sem direitos autorais) do reel Z-TEC.
# 120 BPM, progressão Am-F-C-G, sincronizada com as cenas do ztec-reel.html.
# Uso: python3 make_music.py saida.wav
import sys, wave
import numpy as np

SR = 44100
DUR = 50.0
BEAT = 0.5
BAR = BEAT * 4
DROP = 12.0          # entrada do logo
END_FADE = 2.5
rng = np.random.default_rng(42)

L = np.zeros(int(SR * DUR))
R = np.zeros(int(SR * DUR))


def add(start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= len(L):
        return
    j = min(len(L), i + len(sig))
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - pan) ** 0.5 if pan > 0 else s
    R[i:j] += s * (1 + pan) ** 0.5 if pan < 0 else s


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def env(x, a=0.005, d=0.3):
    return np.minimum(x / a, 1) * np.exp(-x / d)


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, "same")


CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G

# --- drums -------------------------------------------------------------
def kick(gain=1.0):
    x = tt(0.45)
    return np.sin(2 * np.pi * (45 + 110 * np.exp(-x * 35)) * x) * np.exp(-x * 7) * gain


def clap():
    x = tt(0.25)
    n = rng.normal(0, 1, len(x))
    n = n - lowpass(n, 6)
    e = sum(env(np.maximum(x - o, 0) + 1e-9, 0.001, 0.012) * (x >= o) for o in (0, 0.012, 0.024))
    return n * (e * 0.6 + env(x, 0.001, 0.08) * 0.5)


def hat(open_=False):
    x = tt(0.25 if open_ else 0.06)
    n = rng.normal(0, 1, len(x))
    n = n - lowpass(n, 3)
    return n * env(x, 0.001, 0.08 if open_ else 0.015)


def tick():
    x = tt(0.05)
    return np.sin(2 * np.pi * 2600 * x) * env(x, 0.0005, 0.008)


def ding():
    x = tt(0.9)
    return (np.sin(2 * np.pi * 1318.5 * x) + 0.5 * np.sin(2 * np.pi * 1975.5 * x) + 0.2 * np.sin(2 * np.pi * 2637 * x)) * env(x, 0.002, 0.22)


def whoosh(length=0.7):
    x = tt(length)
    n = lowpass(rng.normal(0, 1, len(x)), 18)
    return n * np.sin(np.pi * x / length) ** 3


def riser(length):
    x = tt(length)
    n = rng.normal(0, 1, len(x))
    n = n - lowpass(n, 4)
    tone = np.sin(2 * np.pi * (200 * x + 600 * x ** 2 / length))
    return (n * 0.5 + tone * 0.3) * (x / length) ** 2.2


def impact():
    x = tt(2.5)
    boom = np.sin(2 * np.pi * (35 + 70 * np.exp(-x * 6)) * x) * np.exp(-x * 1.6)
    crash = rng.normal(0, 1, len(x))
    crash = (crash - lowpass(crash, 3)) * np.exp(-x * 1.4) * 0.35
    return boom + crash


# --- synths -------------------------------------------------------------
def pad(chord, length, bright=1.0):
    x = tt(length)
    s = np.zeros_like(x)
    for m in chord + [chord[0] + 12]:
        for det in (-0.08, 0.0, 0.08):
            f = midi(m + det)
            s += np.sin(2 * np.pi * f * x) + 0.35 * bright * np.sin(4 * np.pi * f * x) + 0.12 * bright * np.sin(6 * np.pi * f * x)
    s *= np.minimum(x / 0.25, 1) * np.minimum((length - x) / 0.2, 1)
    return s / 14


def pluck(m, length=0.4):
    x = tt(length)
    f = midi(m)
    s = np.sign(np.sin(2 * np.pi * f * x)) * 0.25 + np.sin(2 * np.pi * f * x)
    return lowpass(s, 3) * env(x, 0.002, 0.12)


def bass(m, length):
    x = tt(length)
    f = midi(m)
    s = np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x)
    return s * np.minimum(x / 0.005, 1) * np.minimum((length - x) / 0.02, 1)


# sidechain envelope (pumping) after the drop
side = np.ones(len(L))
for b in range(int(DROP / BEAT), int(DUR / BEAT)):
    i = int(b * BEAT * SR)
    x = tt(BEAT)
    e = 1 - 0.7 * np.exp(-x * 12)
    j = min(len(side), i + len(e))
    side[i:j] = e[: j - i]

pads_L = np.zeros(len(L))
for k in range(int(DUR / BAR) + 1):
    t0 = k * BAR
    ch = CHORDS[k % 4]
    p = pad(ch, BAR, bright=0.4 if t0 < DROP else 1.0)
    i = int(t0 * SR)
    j = min(len(L), i + len(p))
    if i < len(L):
        pads_L[i:j] += p[: j - i] * (0.6 if t0 < DROP else 1.0)

    # bass
    if 4 <= t0 < DROP:          # tensão: colcheias
        for e8 in range(8):
            add(t0 + e8 * BEAT / 2, bass(ch[0] - 24, BEAT / 2 * 0.8) * (0.5 + 0.1 * (e8 % 2)), gain=0.28)
    elif t0 >= DROP:            # drop: baixo off-beat
        for b in range(4):
            add(t0 + b * BEAT + BEAT / 2, bass(ch[0] - 24, BEAT / 2 * 0.9), gain=0.32)

    # arpejo depois do drop
    if t0 >= DROP + 4:
        notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]
        for s16 in range(16):
            add(t0 + s16 * BEAT / 4, pluck(notes[s16 % 4]), pan=0.35 if s16 % 2 else -0.35, gain=0.09)

L += pads_L * side * 0.9
R += pads_L * side * 0.9

for b in range(int(DUR / BEAT)):
    t0 = b * BEAT
    if t0 < 4:                       # intro: relógio
        add(t0, tick(), gain=0.25)
        if b % 2 == 0:
            add(t0, kick(0.45))
    elif t0 < DROP:                  # tensão
        add(t0, tick(), gain=0.3)
        add(t0 + BEAT / 2, tick(), gain=0.15)
        add(t0, kick(0.7))
        if b % 2 == 1:
            add(t0, clap(), gain=0.25)
    else:                            # drop
        add(t0, kick(1.0))
        add(t0 + BEAT / 2, hat(open_=(b % 4 == 3)), pan=0.2, gain=0.18)
        add(t0 + BEAT / 4, hat(), pan=-0.2, gain=0.07)
        add(t0 + 3 * BEAT / 4, hat(), pan=-0.2, gain=0.07)
        if b % 2 == 1:
            add(t0, clap(), gain=0.45)

# rolo de caixa antes do drop
for i in range(16):
    add(DROP - 1 + i / 16, clap(), gain=0.08 + 0.25 * i / 16)

# efeitos sincronizados com as cenas
for t in (4.5, 5.0, 5.5, 6.0, 6.5):                     # notificações
    add(t, ding(), pan=0.3 if int(t * 2) % 2 else -0.3, gain=0.22)
add(DROP - 2.2, riser(2.2), gain=0.5)                  # subida para o logo
add(DROP, impact(), gain=0.9)                          # impacto do logo
for t in (4, 8, 16, 20, 26, 32, 36, 40, 44):           # whoosh nas transições
    add(t - 0.55, whoosh(), gain=0.35)
for t in (36.1, 37.1, 38.1):                           # mais economia / eficiência / menos complicação
    add(t, impact()[: int(0.8 * SR)], gain=0.35)
add(47.5, tick(), gain=0.6)                            # toque no botão do WhatsApp
add(47.5, ding(), gain=0.15)

# master
t = np.arange(len(L)) / SR
fade = np.minimum(1, (DUR - t) / END_FADE) * np.minimum(1, t / 0.05)
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix * 1.4)
mix /= np.abs(mix).max() * 1.08
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
