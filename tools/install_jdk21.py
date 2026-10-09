# -*- coding: utf-8 -*-
"""下载 JDK 21（Capacitor 8 插件编译要求 Java 21）"""
import json
import os
import shutil
import zipfile
import urllib.request

BASE = 'd:/workbuddy-workplace/.toolchain'
DEST = os.path.join(BASE, 'jdk21')

API = ('https://api.adoptium.net/v3/assets/latest/21/hotspot'
       '?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')


def get(url, timeout=600):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    if os.path.isfile(os.path.join(DEST, '.ok')):
        print('SKIP jdk21 already installed')
        return

    urls = []
    try:
        data = json.loads(get(API, 120))
        for asset in data:
            for b in asset.get('binaries', []):
                pkg = b.get('package', {})
                if pkg.get('name', '').endswith('.zip'):
                    urls.append(pkg.get('link'))
    except Exception as e:
        print('api failed:', type(e).__name__, e)

    urls.append('https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse')
    urls = [u for u in urls if u]

    if os.path.isdir(DEST):
        shutil.rmtree(DEST, ignore_errors=True)
    os.makedirs(DEST)

    tmp = os.path.join(BASE, 'jdk21.zip')
    for url in urls:
        try:
            print('trying', url, flush=True)
            data = get(url)
            print('  got', len(data), flush=True)
            with open(tmp, 'wb') as f:
                f.write(data)
            with zipfile.ZipFile(tmp) as z:
                z.extractall(DEST)
            os.remove(tmp)
            with open(os.path.join(DEST, '.ok'), 'w') as f:
                f.write('ok')
            print('OK jdk21 ->', DEST)
            for n in os.listdir(DEST):
                print('  ', n)
            return
        except Exception as e:
            print('  failed:', type(e).__name__, e, flush=True)
    print('ALL JDK21 SOURCES FAILED')


if __name__ == '__main__':
    main()
