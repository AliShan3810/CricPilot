#!/usr/bin/env python3
"""
Builds CricPilot's bundled sound effects (src/assets/sounds/*.mp3).

Sources (all downloaded from OpenGameArt.org, licences checked on each page; see docs/ASSET_CREDITS.md):
  - Gregor Quendel, "Free Crowd Cheering Sounds" (CC-BY 4.0)      -> crowd cheers, roars, groans
  - "Applause in a large hall or church" (CC0)                      -> applause
  - "100 CC0 metal and wood SFX" (CC0)                              -> bat cracks, stumps
  - "Swishes Sound Pack" (CC0)                                      -> ball flight whoosh
  - "25 CC0 bang / firework SFX" (CC0)                              -> tournament fireworks
  - "Classic fanfare lick" (CC0)                                    -> milestone sting
  - hjm "Coin Sounds" (CC-BY 3.0)                                   -> coin landing
Everything else (stings, timpani, cymbal swells, coin flick) is synthesised here and is original work.

Usage:
  python3 -m venv .venv && .venv/bin/pip install numpy imageio-ffmpeg
  .venv/bin/python scripts/build-sounds.py <folder with the downloaded/unzipped packs>
"""
import glob
import os
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'sounds')
rng = np.random.default_rng(7)


# ----------------------------------------------------------------------------- io
def load(path, stereo=False):
    ch = 2 if stereo else 1
    raw = subprocess.run([FF, '-v', 'quiet', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    return x.reshape(-1, 2) if stereo else x


def save(name, x, bitrate='160k'):
    x = np.asarray(x, dtype=np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    path = os.path.join(OUT, name)
    subprocess.run([FF, '-v', 'quiet', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', bitrate, path],
                   input=x.astype(np.float32).tobytes(), check=True)
    print(f'{name:28} {len(x) / SR:5.2f}s {os.path.getsize(path) // 1024:4} KB')


def find(root, pattern):
    hits = [p for p in glob.glob(os.path.join(root, '**', pattern), recursive=True) if '/._' not in p]
    if not hits:
        raise SystemExit(f'missing source: {pattern}')
    return hits[0]


# ----------------------------------------------------------------------- helpers
def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def fade(x, fin=0.005, fout=0.25):
    x = stereo(x).copy()
    n = len(x)
    a, b = min(n, int(fin * SR)), min(n, int(fout * SR))
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None]
    if b:
        x[n - b:] *= (np.linspace(1, 0, b) ** 2)[:, None]
    return x


def normalize(x, peak=0.89):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


def mix(length, *layers):
    """layers: (signal, start_seconds, gain)"""
    out = np.zeros((int(length * SR), 2), dtype=np.float32)
    for sig, start, gain in layers:
        s = stereo(sig) * gain
        i = int(start * SR)
        j = min(len(out), i + len(s))
        if j > i:
            out[i:j] += s[: j - i]
    return out


def loudest_window(x, seconds, lead=0.25):
    """Start a little before the steepest rise into the loudest part of a crowd recording."""
    mono = np.abs(x if x.ndim == 1 else x.mean(axis=1))
    win = int(0.25 * SR)
    env = np.convolve(mono, np.ones(win) / win, mode='same')
    n = int(seconds * SR)
    peak_i = int(np.argmax(env[: max(1, len(env) - n)]))
    # walk back to where the swell starts (~55% of the peak level)
    thr = env[peak_i] * 0.55
    i = peak_i
    while i > 0 and env[i] > thr:
        i -= int(0.02 * SR)
    start = max(0, i - int(lead * SR))
    return x[start:start + n]


def lowpass(x, cutoff):
    """One-pole low-pass (applied per channel)."""
    x = stereo(x)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = np.zeros(2, dtype=np.float32)
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return stereo(x) - lowpass(x, cutoff)


def resample_glide(x, start_ratio, end_ratio):
    """Variable-speed playback (pitch glide) — used to turn a cheer into a groan."""
    x = stereo(x)
    ratios = np.linspace(start_ratio, end_ratio, len(x))
    pos = np.cumsum(ratios)
    pos = pos[pos < len(x) - 1]
    i = pos.astype(int)
    frac = (pos - i)[:, None]
    return x[i] * (1 - frac) + x[i + 1] * frac


def reverb(x, decay=1.2, mix_amt=0.25):
    """Cheap stadium-ish reverb: a few decaying, slightly detuned echoes."""
    x = stereo(x)
    out = x.copy()
    for k, (d, g) in enumerate([(0.029, 0.6), (0.047, 0.5), (0.071, 0.42), (0.109, 0.34), (0.163, 0.26), (0.241, 0.18)]):
        n = int(d * SR)
        tail = np.zeros_like(x)
        tail[n:] = x[:-n] * g * np.exp(-d / decay)
        if k % 2:
            tail = tail[:, ::-1]
        out += tail * mix_amt
    return out


# --------------------------------------------------------------------- synthesis
def t(seconds):
    return np.arange(int(seconds * SR)) / SR


def brass_chord(freqs, seconds, attack=0.04, release=0.6, bright=2600):
    """Detuned saw stack through a low-pass: a punchy synth-brass stab."""
    tt = t(seconds)
    sig = np.zeros_like(tt)
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            ph = 2 * np.pi * f * (1 + det) * tt + rng.uniform(0, 6.28)
            sig += (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.12
    env = np.minimum(1, tt / attack) * np.exp(-np.maximum(0, tt - (seconds - release)) * 6)
    return lowpass(sig * env, bright)


def timpani(f0, seconds=1.2, gain=1.0):
    tt = t(seconds)
    f = f0 * (1 + 0.25 * np.exp(-tt * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * 3.2) + 0.4 * np.sin(2.01 * ph) * np.exp(-tt * 6)
    click = rng.normal(0, 1, len(tt)) * np.exp(-tt * 90) * 0.3
    return stereo((body + click) * gain)


def cymbal_swell(seconds=1.4, reverse=True):
    tt = t(seconds)
    n = highpass(rng.normal(0, 1, len(tt)).astype(np.float32), 5000)
    env = (tt / seconds) ** 2.2 if reverse else np.exp(-tt * 3)
    return n * env[:, None] * 0.5


def noise_sweep(seconds=0.9, f_from=600, f_peak=3200, f_to=900):
    """Band-passed noise whose centre rises then falls (a passing-ball whoosh)."""
    tt = t(seconds)
    k = tt / seconds
    centre = np.where(k < 0.45, f_from + (f_peak - f_from) * (k / 0.45), f_peak + (f_to - f_peak) * ((k - 0.45) / 0.55))
    n = rng.normal(0, 1, len(tt)).astype(np.float32)
    out = np.zeros_like(n)
    lo = hi = 0.0
    for i in range(len(n)):  # time-varying band-pass from two one-pole filters
        a_hi = np.exp(-2 * np.pi * centre[i] * 1.5 / SR)
        a_lo = np.exp(-2 * np.pi * centre[i] / 1.5 / SR)
        hi = (1 - a_hi) * n[i] + a_hi * hi
        lo = (1 - a_lo) * n[i] + a_lo * lo
        out[i] = hi - lo
    env = np.sin(np.pi * k) ** 1.5
    return stereo(out * env)


def metal_ting(seconds=0.6):
    tt = t(seconds)
    partials = [(3150, 1.0, 9), (4710, 0.6, 12), (6920, 0.4, 16), (8840, 0.25, 22)]
    sig = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, a, d in partials)
    return stereo(sig * 0.4)


NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def chord(root, quality='maj', octave=0):
    r = NOTE[root] * 2 ** octave
    third = 2 ** (4 / 12) if quality == 'maj' else 2 ** (3 / 12)
    return [r / 2, r, r * third, r * 2 ** (7 / 12), r * 2]


# ----------------------------------------------------------------------- builds
def main(src):
    os.makedirs(OUT, exist_ok=True)
    wood_hit = load(find(src, 'wood_hit_03.ogg'))
    wood_crack = load(find(src, 'wood_close_02.ogg'))
    wood_body = load(find(src, 'wood_hammer_02.ogg'))
    stumps = load(find(src, 'wood_falling_06.ogg'))
    stumps2 = load(find(src, 'wood_falling_05.ogg'))
    swish = load(find(src, 'swish-9.wav'))
    cheer_strong = load(find(src, '*04 - Strong cheering - II - Short.mp3'), stereo=True)
    cheer_big = load(find(src, '*03 - Strong cheering - I.mp3'), stereo=True)
    cheer_alt = load(find(src, '*01 - Strong cheering and strong rhythmic cheering.mp3'), stereo=True)
    cheer_soft = load(find(src, '*06 - Soft cheering - II.mp3'), stereo=True)
    applause = load(find(src, 'applause-clapping-church-crowd-immersive.wav'), stereo=True)
    fanfare = load(find(src, 'fanfare_3.ogg'), stereo=True)
    coin_drop = load(find(src, 'hjm-coindrop_v1.wav'))
    firework = load(find(src, 'fw_01.ogg'))
    firework2 = load(find(src, 'fw_04.ogg'))

    # --- scoring layer: bat & stumps --------------------------------------------------
    save('bat_four.mp3', normalize(fade(mix(0.45, (wood_hit, 0, 1.0), (highpass(wood_crack, 1800), 0.002, 0.55)), fout=0.12)), '128k')
    save('bat_six.mp3', normalize(fade(reverb(mix(0.6, (wood_crack, 0, 1.0), (wood_body, 0, 0.8), (lowpass(wood_body, 300), 0, 0.7)), 0.8, 0.18), fout=0.18)), '128k')
    slow = resample_glide(swish, 0.5, 0.5)
    whoosh = mix(0.95, (noise_sweep(0.9), 0, 1.0), (slow, 0.28, 0.8))
    save('ball_whoosh.mp3', normalize(fade(whoosh, 0.02, 0.3), 0.6), '128k')
    save('stumps.mp3', normalize(fade(mix(1.0, (stumps, 0, 1.0), (stumps2, 0.09, 0.45)), fout=0.3)), '128k')
    coin = mix(1.6, (metal_ting(0.5), 0, 0.5), (metal_ting(0.4), 0.18, 0.25), (coin_drop[int(0.55 * SR):], 0.85, 1.0))
    save('coin_toss.mp3', normalize(fade(coin, fout=0.3), 0.8), '128k')

    # --- crowd layer ----------------------------------------------------------------------
    save('crowd_cheer.mp3', normalize(fade(loudest_window(cheer_strong, 2.8), 0.12, 1.0), 0.8))
    save('crowd_roar.mp3', normalize(fade(loudest_window(cheer_big, 3.8), 0.08, 1.3), 0.86))
    save('crowd_wicket.mp3', normalize(fade(loudest_window(cheer_alt, 2.6), 0.05, 0.9), 0.82))
    groan_src = loudest_window(cheer_soft, 2.4, lead=0.1)
    groan = lowpass(resample_glide(groan_src, 0.92, 0.62), 1400)
    save('crowd_groan.mp3', normalize(fade(groan, 0.08, 0.7), 0.7))
    save('applause.mp3', normalize(fade(applause[int(2 * SR):int(6.5 * SR)], 0.3, 1.4), 0.75))

    # --- celebration layer: stings -----------------------------------------------------
    milestone = mix(3.2, (fanfare, 0, 0.9), (cymbal_swell(0.6), 0, 0.6), (timpani(NOTE['G'] / 4, 1.4, 0.6), 0.02, 1.0))
    save('sting_milestone.mp3', normalize(fade(reverb(milestone, 1.4, 0.2), fout=0.6), 0.85))
    century = mix(4.2, (cymbal_swell(0.9), 0, 0.8), (fanfare, 0.85, 1.0), (timpani(NOTE['C'] / 4, 1.6, 0.7), 0.86, 1.0),
                  (brass_chord(chord('C', octave=-1), 1.6, release=1.0), 2.4, 0.8))
    save('sting_century.mp3', normalize(fade(reverb(century, 1.6, 0.22), fout=0.9), 0.88))
    victory = mix(4.6, (cymbal_swell(1.0), 0, 0.8),
                  (brass_chord(chord('C', octave=-1), 0.42), 1.0, 0.9),
                  (brass_chord(chord('F', octave=-1), 0.42), 1.42, 0.9),
                  (brass_chord(chord('G', octave=-1), 0.42), 1.84, 0.95),
                  (brass_chord(chord('C', octave=0), 2.3, release=1.4), 2.26, 1.0),
                  (timpani(NOTE['C'] / 4, 1.8, 0.9), 2.26, 1.0))
    save('sting_victory.mp3', normalize(fade(reverb(victory, 1.8, 0.28), fout=1.0), 0.88))
    hattrick = mix(3.6, (timpani(NOTE['G'] / 4, 0.5, 0.8), 0, 1), (timpani(NOTE['A'] / 4, 0.5, 0.8), 0.28, 1), (timpani(NOTE['B'] / 4, 0.5, 0.9), 0.56, 1),
                   (brass_chord(chord('C', octave=0), 2.4, release=1.6), 0.84, 1.0), (timpani(NOTE['C'] / 4, 1.8, 1.0), 0.84, 1.0), (cymbal_swell(0.84), 0, 0.7))
    save('sting_hattrick.mp3', normalize(fade(reverb(hattrick, 1.6, 0.25), fout=0.9), 0.88))
    innings = mix(2.6, (brass_chord(chord('F', octave=-1), 0.5, release=0.3, bright=1800), 0, 0.8), (brass_chord(chord('C', octave=-1), 1.8, release=1.2, bright=1800), 0.5, 0.85),
                  (timpani(NOTE['C'] / 4, 1.4, 0.5), 0.5, 1.0))
    save('sting_innings.mp3', normalize(fade(reverb(innings, 1.4, 0.25), fout=0.8), 0.75))
    # duck: a dramatic low "dun... dunnn" (minor), not a cartoon trombone
    duck = mix(2.6, (timpani(NOTE['D'] / 4, 1.0, 1.0), 0, 1.0), (brass_chord(chord('D', 'min', -1), 0.45, release=0.3, bright=1200), 0.0, 0.7),
               (timpani(NOTE['A'] / 8, 1.6, 1.0), 0.5, 1.0), (brass_chord([NOTE['A'] / 4, NOTE['A'] / 2, NOTE['C'] / 2, NOTE['D#'] / 2], 1.8, release=1.3, bright=900), 0.5, 0.85))
    save('sting_duck.mp3', normalize(fade(reverb(duck, 1.8, 0.3), fout=0.9), 0.8))
    tournament = mix(5.5, (firework, 0, 1.0), (firework2, 0.55, 0.8), (firework, 1.2, 0.7), (victory, 0.3, 0.6))
    save('sting_tournament.mp3', normalize(fade(tournament, fout=1.2), 0.88))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
