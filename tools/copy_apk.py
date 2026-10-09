# -*- coding: utf-8 -*-
"""把构建好的 APK 复制到 dist/ 便于取用。

用法：python tools/copy_apk.py [debug|release]
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARIANT = sys.argv[1] if len(sys.argv) > 1 else 'debug'
NAME = 'app-debug.apk' if VARIANT == 'debug' else 'app-release-unsigned.apk'

SRC = os.path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', VARIANT, NAME)
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(DIST, 'daily-hub-%s.apk' % VARIANT)

if not os.path.isfile(SRC):
    print('未找到', SRC)
    raise SystemExit(1)

if not os.path.isdir(DIST):
    os.makedirs(DIST)
shutil.copy2(SRC, OUT)
print('APK ->', OUT, os.path.getsize(OUT), 'bytes')
