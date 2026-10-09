# -*- coding: utf-8 -*-
"""生成 Android 原生资源：应用图标（含自适应图标）与启动图。

用法：python tools/gen_android_assets.py
输出：android/app/src/main/res/ 下的 mipmap-* 与 drawable/splash.png
"""
import os
import shutil
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# 与主应用一致的配色
C1 = (99, 102, 241)    # 靛蓝
C2 = (139, 92, 246)    # 紫
CARD = (255, 255, 255)
LINE = (99, 102, 241)
BG = (244, 245, 250)   # 启动图底色

DENSITY = {
    'mipmap-mdpi': 1.0,
    'mipmap-hdpi': 1.5,
    'mipmap-xhdpi': 2.0,
    'mipmap-xxhdpi': 3.0,
    'mipmap-xxxhdpi': 4.0,
}

ICON_DP = 48
FOREGROUND_DP = 108


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_rect(x, y, left, top, right, bottom, r):
    if x < left or x > right or y < top or y > bottom:
        return False
    if left + r <= x <= right - r:
        return True
    if top + r <= y <= bottom - r:
        return True
    cx = left + r if x < left + r else right - r
    cy = top + r if y < top + r else bottom - r
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def render(size, painter, ss):
    step = 1.0 / ss
    off = step / 2.0
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for j in range(ss):
                for i in range(ss):
                    cr, cg, cb, ca = painter(x + off + i * step, y + off + j * step)
                    r += cr; g += cg; b += cb; a += ca
            n = ss * ss
            row += bytes((r // n, g // n, b // n, a // n))
        rows.append(bytes(row))
    return rows


def icon_painter(size, mode):
    """mode: square 方形 / round 圆形 / foreground 自适应前景（透明底）"""
    s = float(size)
    radius = s / 2.0

    def base(px, py):
        if mode == 'round':
            cx = cy = s / 2.0
            if (px - cx) ** 2 + (py - cy) ** 2 > (radius - 0.5) ** 2:
                return (0, 0, 0, 0)
        t = (px + py) / (2.0 * s)
        t = 0.0 if t < 0 else (1.0 if t > 1 else t)
        return lerp(C1, C2, t) + (255,)

    if mode == 'foreground':
        # 透明底 + 居中卡片（安全区内，占 60%）
        pad = s * 0.30
        card_l, card_r, card_t, card_b = pad, s - pad, pad, s - pad
        rr = s * 0.13

        def painter(px, py):
            if rounded_rect(px, py, card_l, card_t, card_r, card_b, rr):
                rel_y = (py - card_t) / (card_b - card_t)
                rel_x = (px - card_l) / (card_r - card_l)
                for i, (y0, y1) in enumerate(((0.26, 0.36), (0.46, 0.56), (0.66, 0.76))):
                    if y0 <= rel_y <= y1 and 0.20 <= rel_x <= (0.62 if i == 2 else 0.80):
                        return LINE + (255,)
                return CARD + (255,)
            return (0, 0, 0, 0)
        return painter

    pad = s * 0.22
    card_l, card_r, card_t, card_b = pad, s - pad, pad, s - pad
    rr = s * 0.13

    def painter(px, py):
        pxr, pyr = px, py
        if rounded_rect(pxr, pyr, card_l, card_t, card_r, card_b, rr):
            rel_y = (py - card_t) / (card_b - card_t)
            rel_x = (px - card_l) / (card_r - card_l)
            for i, (y0, y1) in enumerate(((0.24, 0.34), (0.44, 0.54), (0.64, 0.74))):
                if y0 <= rel_y <= y1 and 0.18 <= rel_x <= (0.60 if i == 2 else 0.80):
                    return LINE + (255,)
            return CARD + (255,)
        return base(pxr, pyr)
    return painter


def splash_painter(w, h):
    logo = min(w, h) * 0.34
    lx0, ly0 = (w - logo) / 2.0, (h - logo) / 2.0
    lx1, ly1 = lx0 + logo, ly0 + logo
    rr = logo * 0.20

    def painter(px, py):
        if rounded_rect(px, py, lx0, ly0, lx1, ly1, rr):
            rel_y = (py - ly0) / logo
            rel_x = (px - lx0) / logo
            for i, (y0, y1) in enumerate(((0.26, 0.36), (0.46, 0.56), (0.66, 0.76))):
                if y0 <= rel_y <= y1 and 0.20 <= rel_x <= (0.62 if i == 2 else 0.80):
                    return LINE + (255,)
            return CARD + (255,)
        return BG + (255,)
    return painter


def main():
    if not os.path.isdir(RES):
        print('res 目录不存在，请先执行 npx cap add android')
        return

    for folder, scale in DENSITY.items():
        target = os.path.join(RES, folder)
        if not os.path.isdir(target):
            os.makedirs(target)

        size = int(round(ICON_DP * scale))
        ss = 2 if size <= 216 else 1
        write_png(os.path.join(target, 'ic_launcher.png'), size,
                  render(size, icon_painter(size, 'square'), ss))
        write_png(os.path.join(target, 'ic_launcher_round.png'), size,
                  render(size, icon_painter(size, 'round'), ss))

        fg = int(round(FOREGROUND_DP * scale))
        ss2 = 2 if fg <= 216 else 1
        write_png(os.path.join(target, 'ic_launcher_foreground.png'), fg,
                  render(fg, icon_painter(fg, 'foreground'), ss2))
        print('icons', folder, size, fg)

    # 自适应图标底色
    values = os.path.join(RES, 'values')
    if os.path.isdir(values):
        with open(os.path.join(values, 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                    '    <color name="ic_launcher_background">#6366F1</color>\n</resources>\n')

    # 启动图：只保留 drawable/splash.png，删掉横竖屏变体以免冲突
    for name in ('drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi',
                 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi',
                 'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi',
                 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi'):
        p = os.path.join(RES, name)
        if os.path.isdir(p):
            shutil.rmtree(p)

    w = h = 720
    rows = []
    painter = splash_painter(w, h)
    for y in range(h):
        row = bytearray()
        for x in range(w):
            r, g, b, a = painter(x + 0.5, y + 0.5)
            row += bytes((r, g, b, a))
        rows.append(bytes(row))
    write_png(os.path.join(RES, 'drawable', 'splash.png'), w, rows)
    print('splash 720x720 written')


if __name__ == '__main__':
    main()
