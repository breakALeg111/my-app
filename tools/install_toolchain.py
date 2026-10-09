# -*- coding: utf-8 -*-
"""下载并解压原生构建所需的工具链到项目外目录（不污染仓库）。

用法：python tools/install_toolchain.py
目录：d:/workbuddy-workplace/.toolchain/{node,jdk,android-sdk}
"""
import io
import os
import sys
import zipfile
import urllib.request
import shutil

BASE = 'd:/workbuddy-workplace/.toolchain'

ITEMS = [
    ('node', [
        'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip',
        'https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-win-x64.zip',
    ]),
    ('jdk', [
        'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse',
        'https://mirrors.tuna.tsinghua.edu.cn/Adoptium/17/jdk/x64/windows/OpenJDK17U-jdk_x64_windows_hotspot_17.0.13_11.zip',
    ]),
    ('cmdline-tools', [
        'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip',
        'https://dl.google.com/android/repository/commandlinetools-win-10406996_latest.zip',
    ]),
]


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    with open(dest, 'wb') as f:
        f.write(data)
    return len(data)


def unzip(path, target):
    with zipfile.ZipFile(path) as z:
        z.extractall(target)


def main():
    if not os.path.isdir(BASE):
        os.makedirs(BASE)

    for name, urls in ITEMS:
        target = os.path.join(BASE, name)
        marker = os.path.join(target, '.ok')
        if os.path.isfile(marker):
            print('SKIP', name, 'already installed at', target)
            continue
        if os.path.isdir(target):
            shutil.rmtree(target, ignore_errors=True)
        os.makedirs(target)
        tmp = os.path.join(BASE, name + '.zip')
        ok = False
        for url in urls:
            try:
                print('downloading', name, 'from', url, '...')
                size = download(url, tmp)
                print('  got', size, 'bytes')
                unzip(tmp, target)
                ok = True
                break
            except Exception as e:
                print('  failed:', type(e).__name__, e)
        if os.path.isfile(tmp):
            os.remove(tmp)
        if not ok:
            print('FAILED', name)
            continue
        with open(marker, 'w') as f:
            f.write('ok')
        print('OK', name, '->', target)


if __name__ == '__main__':
    main()
