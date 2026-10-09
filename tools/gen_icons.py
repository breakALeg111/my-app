# -*- coding: utf-8 -*-
"""生成 PWA 图标（纯标准库，无需第三方依赖）。

用法：python tools/gen_icons.py
输出：icons/icon-192.png、icons/icon-512.png、icons/icon-maskable-512.png
"""
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')

# 渐变色：靛蓝 -> 紫
C1 = (99, 102, 241)
C2 = (139, 92, 246)
CARD = (255, 255, 255)
LINE = (99, 102, 241)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_rect_contains(x, y, left, top, right, bottom, r):
    """点是否在圆角矩形内（坐标为像素中心，单位：像素）"""
    if x < left or x > right or y < top or y > bottom:
        return False
    if left + r <= x <= right - r:
        return True
    if top + r <= y <= bottom - r:
        return True
    cx = left + r if x < left + r else right - r
    cy = top + r if y < top + r else bottom - r
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def make_painter(size, maskable):
    s = float(size)
    # maskable 图标需要更大的安全边距
    pad = 0.30 if maskable else 0.21
    card_l, card_r = s * pad, s * (1 - pad)
    card_t, card_b = s * pad, s * (1 - pad)
    radius = s * (0.16 if maskable else 0.14)

    def paint(px, py):
        # px, py 为像素中心坐标
        t = (px + py) / (2.0 * s)
        t = 0.0 if t < 0 else (1.0 if t > 1 else t)
        if rounded_rect_contains(px, py, card_l, card_t, card_r, card_b, radius):
            # 卡片内部的三条横线（模拟日志）
            rel_y = (py - card_t) / (card_b - card_t)
            rel_x0 = (px - card_l) / (card_r - card_l)
            for i, (y0, y1) in enumerate(((0.22, 0.32), (0.44, 0.54), (0.66, 0.76))):
                if y0 <= rel_y <= y1:
                    x_end = 0.80 if i == 2 else 0.78
                    if 0.16 <= rel_x0 <= x_end:
                        return LINE + (255,)
            return CARD + (255,)
        return lerp(C1, C2, t) + (255,)

    return paint


def render(size, maskable, ss=2):
    paint = make_painter(size, maskable)
    rows = []
    step = 1.0 / ss
    offset = step / 2.0
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for j in range(ss):
                for i in range(ss):
                    cr, cg, cb, ca = paint(x + offset + i * step, y + offset + j * step)
                    r += cr; g += cg; b += cb; a += ca
            n = ss * ss
            row += bytes((r // n, g // n, b // n, a // n))
        rows.append(bytes(row))
    return rows


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


def main():
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    for name, size, maskable in (
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-maskable-512.png', 512, True),
    ):
        path = os.path.join(OUT_DIR, name)
        write_png(path, size, render(size, maskable))
        print('generated', path)


if __name__ == '__main__':
    main()
