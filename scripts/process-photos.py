#!/usr/bin/env python3
"""
Crops and optimises CricPilot's background photography into bundled WebP files.

All photos come from Unsplash under the Unsplash License (free for commercial use,
no attribution required; Unsplash+ images are excluded). Credits are kept in
docs/ASSET_CREDITS.md anyway.

Usage:
  1. Download the originals (photo IDs below) to a folder, named <photo-id>.jpg:
       curl -L -o <id>.jpg "https://images.unsplash.com/photo-<id>?fm=jpg&q=90&w=5000&fit=max"
  2. python3 -m venv .venv && .venv/bin/pip install pillow
  3. .venv/bin/python scripts/process-photos.py <folder-with-originals>

The script never upscales more than a few percent: sources are cropped to the
target aspect ratio around a focal point, then downscaled with Lanczos.
"""
import os
import sys

from PIL import Image, ImageEnhance

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'images')

# (output file, photo id, unsplash page, target size, focal x, focal y, grade, description)
# grade: None | 'warm' (gentle orange/teal split tone) | 'duotone' (navy shadows -> orange highlights)
P = 'https://unsplash.com/photos/'
PHOTOS = [
    ('bg_splash_stadium.webp', '1791965081847-e42fc259f7d6', P + 'crowded-cricket-stadium-under-night-floodlights-DjQw6mt4YEM', (1080, 2160), 0.5, 0.5, 'duotone', 'Splash: floodlit night stadium, graded navy/orange'),
    ('bg_home_panorama.webp', '1540747913346-19e32dc3e97e', P + 'crowd-of-people-sitting-on-stadium-seats-bY4cqxp7vos', (1080, 1500), 0.5, 0.42, None, 'Home hero: floodlit stadium at night'),
    ('onboard_1_batter.webp', '1593341646782-e0b495cff86d', P + 'cricket-batsman-hitting-ball-on-field-dE3exzmYlKc', (1080, 2160), 0.55, 0.5, 'warm', 'Onboarding 1: batter driving the ball'),
    ('onboard_2_stadium.webp', '1750716413756-b66624b64ce4', P + 'a-cricket-stadium-is-filled-with-spectators-at-night-uplPFLDsn84', (1080, 2160), 0.5, 0.5, None, 'Onboarding 2: packed stadium under lights'),
    ('onboard_3_ball.webp', '1531415074968-036ba1b575da', P + 'shallow-focus-photography-of-red-cricket-ball-oDs_AxeR5g4', (1080, 2160), 0.76, 0.5, None, 'Onboarding 3: red ball in the grass'),
    ('bg_matchup.webp', '1794500240266-ef2f5e398852', P + 'cricket-players-shaking-hands-on-field-i63FfZJN5Fs', (1080, 2160), 0.55, 0.45, 'warm', 'Head-to-head: captains shaking hands'),
    ('bg_aerial_ground.webp', '1759210720510-59dfa8ff9f85', P + 'aerial-view-of-a-city-with-a-large-oval-stadium-Pk464ATFHxw', (1080, 2160), 0.5, 0.35, None, 'Match setup: aerial view of an oval ground'),
    ('bg_xi_gloves.webp', '1785906359585-9c053458d551', P + 'a-man-in-cricket-gear-adjusts-his-batting-gloves-indoors-5SJN8sBJtJg', (1080, 2160), 0.45, 0.5, 'warm', 'Playing XI: padding up in the nets'),
    ('bg_toss_ball.webp', '1743343179056-d235b33c4f0c', P + 'a-hand-balances-a-cricket-ball-1Ls6HxVr5fM', (1080, 2160), 0.55, 0.45, None, 'Toss: a hand balancing the ball'),
    ('bg_pitch.webp', '1674986778924-7a33c1531443', P + 'a-cricket-field-with-a-bat-and-ball-on-it-p8BO9zThWV8', (1080, 2160), 0.5, 0.55, None, 'Scorecard and texture: pitch, stumps and creases'),
    ('bg_scoring_stadium.webp', '1783064553091-2d45b3f426cd', P + 'a-modern-cricket-stadium-with-empty-seats-at-sunset-0eqcfjZlVKQ', (1080, 2160), 0.5, 0.5, None, 'Live scoring: stadium at sunset'),
    ('bg_teams_helmet.webp', '1776229705264-6b437229654b', P + 'a-young-man-wearing-a-cricket-helmet-and-white-uniform-coXSwcAW0O0', (1080, 2160), 0.5, 0.4, 'warm', 'Teams: batter in a helmet'),
    ('bg_player.webp', '1776229705528-9bcd14792045', P + 'cricketer-in-a-dark-helmet-on-a-sunny-field-Ysmv55PONTo', (1080, 2160), 0.55, 0.4, 'warm', 'Player profiles: helmet profile'),
    ('bg_tournament_trophy.webp', '1637635753380-20bf6f46ede0', P + 'a-trophy-sitting-on-top-of-a-lush-green-field-E_OVdx3dbnU', (1080, 2160), 0.5, 0.6, 'warm', 'Tournaments: trophy on the outfield'),
    ('bg_tournament_stadium.webp', '1774167766011-004b8acb8e3b', P + 'a-wide-view-of-a-cricket-stadium-with-green-field-AInWsdrHmJ4', (1080, 2160), 0.5, 0.5, None, 'Tournament detail: wide stadium view'),
    ('bg_victory.webp', '1794500240348-8fc6c86045e1', P + 'cricket-player-celebrating-on-field-WU2OIQjTevQ', (1080, 2160), 0.5, 0.4, 'warm', 'Victory and milestones: raising helmet and bat'),
    ('bg_history_batter.webp', '1794500240266-e2ea64acad25', P + 'cricket-batsman-swinging-wooden-bat-U-3UNrYLjIs', (1080, 2160), 0.55, 0.45, 'warm', 'Match history: batter mid-shot'),
    ('bg_stats_crowd.webp', '1675693303492-9a5bc898bf94', P + 'cricket-stadium-under-red-evening-sky-K3cI9zl79Bg', (1080, 2160), 0.5, 0.5, None, 'Leaderboards: stadium under a red evening sky'),
    ('bg_settings_floodlight.webp', '1780161485625-8034fc82583e', P + 'bright-stadium-lights-illuminate-a-cloudy-evening-sky-nMivg2zAAG4', (1080, 2160), 0.5, 0.4, 'duotone', 'Settings: floodlight tower'),
    ('bg_bat_wall.webp', '1758791184255-411236a49346', P + 'cricket-bat-leaning-against-a-stone-wall-KGrQ_DNABik', (1080, 2160), 0.6, 0.6, 'warm', 'Team/player forms: bat against a wall'),
]


def grade(img, kind):
    if kind is None:
        return img
    if kind == 'duotone':
        g = img.convert('L')
        lut = []
        stops = [(0, (6, 10, 24)), (110, (18, 32, 64)), (190, (255, 107, 0)), (255, (255, 236, 214))]
        for c in range(3):
            for v in range(256):
                for (a, ca), (b, cb) in zip(stops, stops[1:]):
                    if a <= v <= b:
                        t = (v - a) / (b - a)
                        lut.append(int(ca[c] + (cb[c] - ca[c]) * t))
                        break
        return Image.merge('RGB', [g.point(lut[i * 256:(i + 1) * 256]) for i in range(3)])
    # warm: lift orange in highlights, teal-navy in shadows, a little saturation
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * 1.06 + 4)))
    b = b.point(lambda v: int(v * 0.92 + 10 * (1 - v / 255)))
    out = Image.merge('RGB', (r, g, b))
    return ImageEnhance.Color(out).enhance(1.08)


ZOOM = {'bg_home_panorama.webp': 1.25}


def crop_to(img, size, fx, fy, zoom=1.0):
    tw, th = size
    target = tw / th
    w, h = img.size
    if w / h > target:
        cw, ch = int(h * target), h
    else:
        cw, ch = w, int(w / target)
    cw, ch = int(cw / zoom), int(ch / zoom)
    left = min(max(0, int(fx * w - cw / 2)), w - cw)
    top = min(max(0, int(fy * h - ch / 2)), h - ch)
    return img.crop((left, top, left + cw, top + ch)).resize(size, Image.LANCZOS)


def main(src):
    os.makedirs(OUT, exist_ok=True)
    for name, pid, _page, size, fx, fy, kind, _desc in PHOTOS:
        img = Image.open(os.path.join(src, f'{pid}.jpg')).convert('RGB')
        out = crop_to(img, size, fx, fy, ZOOM.get(name, 1.0))
        out = grade(ImageEnhance.Contrast(out).enhance(1.04), kind)
        path = os.path.join(OUT, name)
        out.save(path, 'WEBP', quality=78, method=6)
        print(f'{name}: {size[0]}x{size[1]} {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
