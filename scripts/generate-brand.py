#!/usr/bin/env python3
"""
Draws the CricPilot mark and writes:
  - src/assets/brand/logo.svg            (vector source, also used in-app via react-native-svg)
  - src/assets/brand/logo-1024.png       (master raster)
  - src/assets/brand/splash-logo.png     (transparent mark for the native splash)
  - iOS AppIcon (1024 single-size) and Android mipmaps (square + round)

The mark: a rounded shield in deep navy, a sky-blue ball, and a gold seam that
leaves the ball as a rising flight path ending in a chevron.
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
BRAND = os.path.join(ROOT, 'src', 'assets', 'brand')
os.makedirs(BRAND, exist_ok=True)

BALL = (0.42, 0.58, 0.25)  # cx, cy, r
SEAM = [(0.215, 0.49), (0.29, 0.70), (0.45, 0.80), (0.60, 0.745)]  # curved seam across the ball
FLIGHT = [(0.60, 0.745), (0.72, 0.70), (0.78, 0.44), (0.855, 0.205)]  # rising flight path


def bez(t, p):
    a, b, c, d = p
    mt = 1 - t
    return (
        mt ** 3 * a[0] + 3 * mt * mt * t * b[0] + 3 * mt * t * t * c[0] + t ** 3 * d[0],
        mt ** 3 * a[1] + 3 * mt * mt * t * b[1] + 3 * mt * t * t * c[1] + t ** 3 * d[1],
    )


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial(size, c0, c1, center=(0.35, 0.3)):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x / size - center[0], y / size - center[1]) / 1.1
            px[x, y] = lerp(c0, c1, min(1, d))
    return img


def draw_mark(size, with_bg=True, round_mask=False):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if with_bg:
        bg = radial(S // 8, (34, 43, 58), (11, 17, 32)).resize((S, S), Image.BICUBIC)
        mask = Image.new('L', (S, S), 0)
        md = ImageDraw.Draw(mask)
        if round_mask:
            md.ellipse([0, 0, S, S], fill=255)
        else:
            md.rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=255)
        img.paste(bg, (0, 0), mask)
        # inner rim light
        rim = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        rd = ImageDraw.Draw(rim)
        inset = int(S * 0.035)
        if round_mask:
            rd.ellipse([inset, inset, S - inset, S - inset], outline=(255, 107, 0, 90), width=int(S * 0.012))
        else:
            rd.rounded_rectangle([inset, inset, S - inset, S - inset], radius=int(S * 0.19), outline=(255, 107, 0, 90), width=int(S * 0.012))
        img = Image.alpha_composite(img, rim)
    scale = 0.78 if round_mask else 1.0
    off = (1 - scale) / 2

    def P(x, y):
        return ((off + x * scale) * S, (off + y * scale) * S)

    # ball glow
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = P(BALL[0], BALL[1])
    r = BALL[2] * S * scale
    gd.ellipse([cx - r * 1.25, cy - r * 1.25, cx + r * 1.25, cy + r * 1.25], fill=(255, 107, 0, 110))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(S * 0.04)))
    # ball body with gradient
    ball = radial(S // 8, (255, 179, 122), (232, 93, 0), center=(0.3, 0.25)).resize((S, S), Image.BICUBIC)
    bm = Image.new('L', (S, S), 0)
    ImageDraw.Draw(bm).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    img.paste(ball, (0, 0), bm)
    d = ImageDraw.Draw(img)
    # seam + flight path
    pts = [P(*bez(i / 200, SEAM)) for i in range(201)] + [P(*bez(i / 200, FLIGHT)) for i in range(1, 201)]
    w = max(2, int(S * 0.034 * scale))
    d.line(pts, fill=(255, 246, 236, 255), width=w, joint='curve')
    for q in (pts[0], pts[-1]):
        d.ellipse([q[0] - w / 2, q[1] - w / 2, q[0] + w / 2, q[1] + w / 2], fill=(255, 246, 236, 255))
    # stitches along the seam
    for i in range(14, 190, 22):
        t = i / 200
        x, y = P(*bez(t, SEAM))
        x2, y2 = P(*bez(t + 0.005, SEAM))
        ang = math.atan2(y2 - y, x2 - x) + math.pi / 2
        L = S * 0.03 * scale
        for sgn in (-1, 1):
            d.line([x, y, x + sgn * L * math.cos(ang), y + sgn * L * math.sin(ang)], fill=(255, 226, 200, 255), width=max(1, int(S * 0.012 * scale)))
    # chevron at the end of the flight path
    ex, ey = P(*FLIGHT[3])
    bx, by = P(*bez(0.94, FLIGHT))
    ang = math.atan2(ey - by, ex - bx)
    L = S * 0.11 * scale
    for sgn in (-1, 1):
        a = ang + math.pi - sgn * 0.6
        d.line([ex, ey, ex + L * math.cos(a), ey + L * math.sin(a)], fill=(255, 246, 236, 255), width=w)
    d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=(255, 246, 236, 255))
    return img.resize((size, size), Image.LANCZOS)


def svg():
    c = lambda p: f'{p[0] * 100:.1f} {p[1] * 100:.1f}'
    cx, cy, r = BALL[0] * 100, BALL[1] * 100, BALL[2] * 100
    end = FLIGHT[3]
    before = bez(0.94, FLIGHT)
    ang = math.atan2(end[1] - before[1], end[0] - before[0])
    arm = 11
    left = (end[0] * 100 + arm * math.cos(ang + math.pi - 0.6), end[1] * 100 + arm * math.sin(ang + math.pi - 0.6))
    right = (end[0] * 100 + arm * math.cos(ang + math.pi + 0.6), end[1] * 100 + arm * math.sin(ang + math.pi + 0.6))
    a, b, cc, d = SEAM
    _, f1, f2, f3 = FLIGHT
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="100%"><stop offset="0" stop-color="#222B3A"/><stop offset="1" stop-color="#0B1120"/></radialGradient>
    <radialGradient id="ball" cx="30%" cy="25%" r="85%"><stop offset="0" stop-color="#FFB37A"/><stop offset="1" stop-color="#E85D00"/></radialGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  <rect x="3.5" y="3.5" width="93" height="93" rx="19" fill="none" stroke="#FF6B00" stroke-opacity="0.35" stroke-width="1.2"/>
  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#ball)"/>
  <path d="M{c(a)} C{c(b)} {c(cc)} {c(d)} C{c(f1)} {c(f2)} {c(f3)}" fill="none" stroke="#FFF6EC" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M{left[0]:.1f} {left[1]:.1f} L{c(end)} L{right[0]:.1f} {right[1]:.1f}" fill="none" stroke="#FFF6EC" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


if __name__ == '__main__':
    with open(os.path.join(BRAND, 'logo.svg'), 'w') as f:
        f.write(svg())
    master = draw_mark(1024)
    master.save(os.path.join(BRAND, 'logo-1024.png'))
    # splash logo: the mark itself (with its tile), transparent around it
    draw_mark(512).save(os.path.join(BRAND, 'splash-logo.png'))

    # iOS: single-size 1024 app icon (no alpha allowed)
    ios_dir = os.path.join(ROOT, 'ios', 'CricPilot', 'Images.xcassets', 'AppIcon.appiconset')
    os.makedirs(ios_dir, exist_ok=True)
    full = draw_mark(1024)
    flat = Image.new('RGB', (1024, 1024), (11, 17, 32))
    # iOS masks the corners itself, so fill the whole square
    sq = draw_mark(1024)
    flat.paste(sq, (0, 0), sq)
    flat.save(os.path.join(ios_dir, 'AppIcon-1024.png'))
    with open(os.path.join(ios_dir, 'Contents.json'), 'w') as f:
        json.dump({
            'images': [{'filename': 'AppIcon-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}],
            'info': {'author': 'xcode', 'version': 1},
        }, f, indent=2)

    # Android mipmaps
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    for folder, px in [('mipmap-mdpi', 48), ('mipmap-hdpi', 72), ('mipmap-xhdpi', 96), ('mipmap-xxhdpi', 144), ('mipmap-xxxhdpi', 192)]:
        os.makedirs(os.path.join(res, folder), exist_ok=True)
        draw_mark(px).save(os.path.join(res, folder, 'ic_launcher.png'))
        draw_mark(px, round_mask=True).save(os.path.join(res, folder, 'ic_launcher_round.png'))
    print('brand assets written')
