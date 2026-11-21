#!/usr/bin/env python3
"""Tanıtım videosunun müziği: tamamen sentezlenir (örnek ya da hazır ses kullanılmaz).

96 BPM, D majör; bir ölçü 2,5 sn. Katmanlar: pad (yumuşak, hafif akortsuz), arpej (pluck), bas, hafif davul,
sahne geçişlerinde yumuşak "whoosh". Sonda yankı ve yumuşak sınırlayıcı.
Kullanım: python3 scripts/video/music.py build/video/music.wav [süre_sn]
"""
import sys, wave
import numpy as np

SR = 48000
BPM = 96
BEAT = 60 / BPM            # 0,625 sn
BAR = 4 * BEAT             # 2,5 sn
OUT = sys.argv[1] if len(sys.argv) > 1 else 'build/video/music.wav'
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
N = int(SR * (DUR + 3))
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t0, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i].copy()
    k = min(len(sig), int(0.04 * SR))          # kesilen notada çıtırtı olmasın: son 40 ms yumuşak sönüm
    sig[len(sig) - k:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k))
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * lg * gain * 1.414
    R[i:i + len(sig)] += sig * rg * gain * 1.414


def env_adsr(n, a, d, s, r, sustain_len):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where((t >= a + d) & (t < sustain_len), s, e)
    e = np.where(t >= sustain_len, s * np.exp(-(t - sustain_len) / max(r, 1e-4) * 3), e)
    return e


def soft_tone(f, n, harm=6, slope=1.7, phase=None):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, harm + 1):
        if f * k > 9000: break
        out += np.sin(2 * np.pi * f * k * t + (phase if phase is not None else rng.uniform(0, 6.28))) / k ** slope
    return out


# ------------------------------------------------------------------ akorlar (MIDI)
# I – V/3 – vi – IV  ve  IV – I/3 – ii – V
PROG_A = [[50, 57, 62, 66], [49, 57, 61, 64], [47, 54, 59, 62], [43, 55, 59, 62]]        # D, A/C#, Bm, G
PROG_B = [[43, 55, 59, 62], [42, 54, 57, 62], [40, 55, 59, 64], [45, 57, 61, 64]]        # G, D/F#, Em, A
BASS_A = [38, 37, 35, 43]          # D2, C#2, B1, G2 (küçük hoparlörlerde duyulsun diye 40 Hz altına inilmez)
BASS_B = [43, 42, 40, 45]

n_bars = int(np.ceil(DUR / BAR))
chords, basses = [], []
for b in range(n_bars):
    block = (b // 4) % 4
    prog, bass = (PROG_B, BASS_B) if block == 2 else (PROG_A, BASS_A)
    chords.append(prog[b % 4]); basses.append(bass[b % 4])

# bölümler (sn): giriş, arpej, davul, sakin bölüm, davul geri, kapanış
T_ARP, T_DRUM, T_BREAK, T_BACK, T_END = 5.0, 10.0, 52.5, 65.0, 82.5

# ------------------------------------------------------------------ pad
for b, ch in enumerate(chords):
    t0 = b * BAR
    if t0 > T_END + BAR: break
    last = t0 >= T_END
    dur = BAR + (5.0 if last else 0.9)
    n = int(dur * SR)
    for j, m in enumerate(ch):
        f = hz(m + 12 if j == 0 else m)
        for det, pan in ((-6, -0.6), (0, 0.0), (6, 0.6)):
            ff = f * 2 ** (det / 1200)
            tone = soft_tone(ff, n, harm=5, slope=1.9)
            e = env_adsr(n, 0.9 if b == 0 else 0.45, 0.3, 0.85, 1.2, BAR + (3.5 if last else 0.25))
            lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.21 * np.arange(n) / SR + j)
            add(tone * e * lfo, t0 - (0.0 if b == 0 else 0.3), pan, 0.030)

# ------------------------------------------------------------------ arpej (pluck)
pattern = [0, 2, 1, 3, 2, 1, 3, 2]       # akor sesleri, sekizlikler
for b, ch in enumerate(chords):
    t0 = b * BAR
    if t0 < T_ARP or t0 >= T_END: continue
    notes = sorted(ch[1:]) + [ch[1] + 12]
    for s in range(8):
        tt = t0 + s * BEAT / 2
        m = notes[pattern[(s + b) % 8] % len(notes)] + 12
        n = int(1.4 * SR)
        t = np.arange(n) / SR
        sig = np.zeros(n)
        for k in range(1, 8):
            sig += np.sin(2 * np.pi * hz(m) * k * t) / k ** 2.2 * np.exp(-t * (2.6 + 1.8 * k))
        sig *= np.minimum(1, t / 0.004)
        vel = 0.75 + 0.25 * (s % 2 == 0)
        add(sig, tt, -0.35 if s % 2 else 0.35, 0.050 * vel)

# ------------------------------------------------------------------ bas
for b, m in enumerate(basses):
    t0 = b * BAR
    if t0 < T_ARP or t0 >= T_END: continue
    for beat in (0, 2.5):
        n = int((BEAT * (2.5 if beat == 0 else 1.5)) * SR)
        sig = np.sin(2 * np.pi * hz(m) * np.arange(n) / SR) + 0.25 * np.sin(2 * np.pi * 2 * hz(m) * np.arange(n) / SR)
        e = env_adsr(n, 0.015, 0.2, 0.7, 0.12, n / SR - 0.12)
        add(np.tanh(1.6 * sig * e) / 1.6, t0 + beat * BEAT, 0, 0.12)

# ------------------------------------------------------------------ davul
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 46 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.15 * rng.standard_normal(n) * np.exp(-t * 400)


def hat():
    n = int(0.12 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))   # yüksek geçiren
    return x * np.exp(-t * 55)


def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = np.convolve(x, np.ones(6) / 6, mode='same') - np.convolve(x, np.ones(60) / 60, mode='same')   # bant
    e = np.exp(-t * 22) * (1 + 0.6 * (np.exp(-((t - 0.012) / 0.003) ** 2) + np.exp(-((t - 0.024) / 0.003) ** 2)))
    return x * e


K, Hh, C = kick(), hat(), clap()
kick_times = []
for b in range(n_bars):
    t0 = b * BAR
    drums = (T_DRUM <= t0 < T_BREAK) or (T_BACK <= t0 < T_END)
    if not drums: continue
    for q in range(4):
        tq = t0 + q * BEAT
        if q in (0, 2) or (q == 3 and b % 4 == 3):
            add(K, tq, 0, 0.34); kick_times.append(tq)
        if q in (1, 3) and t0 >= T_DRUM + 2 * BAR:
            add(C, tq, 0.1, 0.10)
        add(Hh, tq + BEAT / 2, 0.25, 0.05)
        if t0 >= T_DRUM + 4 * BAR:
            add(Hh, tq, -0.25, 0.022)

# ------------------------------------------------------------------ geçiş sesleri (whoosh, ters zil)
def whoosh(d=1.2):
    n = int(d * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n); y = y2 = 0.0
    cut = 0.004 + 0.10 * (t / d) ** 2        # iki kademeli süzgeç giderek açılır (en çok ≈ 1 kHz)
    for i in range(n):
        y += cut[i] * (x[i] - y); y2 += cut[i] * (y - y2); out[i] = y2
    e = (t / d) ** 2.2 * np.exp(-np.maximum(0, t - d * 0.92) * 40)
    return out * e


W = whoosh()
for tt in (T_ARP, T_END):
    add(W, tt - 1.15, -0.3, 0.55); add(W, tt - 1.15, 0.3, 0.55)

# ------------------------------------------------------------------ pompalama (davula göre pad hafif iner)
duck = np.ones(N)
for tk in kick_times:
    i = int(tk * SR); n = int(0.35 * SR)
    seg = 1 - 0.22 * np.exp(-np.arange(n) / SR * 9)
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[: max(0, min(n, N - i))])
L *= duck; R *= duck

# ------------------------------------------------------------------ yankı (sentetik dürtü yanıtı, FFT ile)
def reverb(x, seed):
    g = np.random.default_rng(seed)
    n = int(2.6 * SR); t = np.arange(n) / SR
    ir = g.standard_normal(n) * np.exp(-t * 2.6)
    ir = np.convolve(ir, np.ones(24) / 24, mode='same')      # karanlık yankı
    ir[: int(0.02 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
    return y


wl, wr = reverb(L, 1), reverb(R, 2)
L2, R2 = L + 0.32 * wl, R + 0.32 * wr

# ------------------------------------------------------------------ toparlama
def movavg(x, w):
    c = np.cumsum(np.concatenate([[0.0], x]))
    y = (c[w:] - c[:-w]) / w
    return np.concatenate([np.full(w // 2, y[0]), y, np.full(len(x) - len(y) - w // 2, y[-1])])


for ch in (L2, R2):
    ch -= movavg(ch, 4800)   # DC ve 10 Hz altı temizliği
end = int(DUR * SR)
fade = np.ones(N)
fade[end - int(4.0 * SR): end] = np.linspace(1, 0, int(4.0 * SR)) ** 1.5
fade[end:] = 0
fade[: int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
L2 *= fade; R2 *= fade
peak = max(np.abs(L2).max(), np.abs(R2).max())
L2, R2 = L2 / peak * 0.95, R2 / peak * 0.95
L2, R2 = np.tanh(1.3 * L2) / np.tanh(1.3), np.tanh(1.3 * R2) / np.tanh(1.3)
pcm = (np.stack([L2[:end], R2[:end]], axis=1) * 32767 * 0.89).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('müzik:', OUT, '%.1f sn' % DUR)
