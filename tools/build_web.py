# -*- coding: utf-8 -*-
"""把 Web 资源收集到 www/ 目录，供 Capacitor 打包进 Android 工程。

用法：python tools/build_web.py
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, 'www')

FILES = ['index.html', 'manifest.json', 'sw.js']
DIRS = ['css', 'js', 'icons', 'vendor']


CAP_SRC = os.path.join(ROOT, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js')
CAP_DST = os.path.join(ROOT, 'vendor', 'capacitor', 'capacitor.js')


def sync_capacitor_core():
    """把 Capacitor 桥接脚本放进 vendor/（浏览器里为空操作，原生环境提供桥接）"""
    if not os.path.isfile(CAP_SRC):
        return
    folder = os.path.dirname(CAP_DST)
    if not os.path.isdir(folder):
        os.makedirs(folder)
    shutil.copy2(CAP_SRC, CAP_DST)


def main():
    sync_capacitor_core()

    if os.path.isdir(WWW):
        shutil.rmtree(WWW)
    os.makedirs(WWW)

    for name in FILES:
        src = os.path.join(ROOT, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(WWW, name))

    for name in DIRS:
        src = os.path.join(ROOT, name)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(WWW, name))

    count = 0
    for _, _, files in os.walk(WWW):
        count += len(files)
    print('www/ ready:', count, 'files')


if __name__ == '__main__':
    main()
