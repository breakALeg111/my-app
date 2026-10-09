# -*- coding: utf-8 -*-
"""下载 Node 22 LTS（Capacitor CLI 要求 >=22）"""
import json
import os
import zipfile
import urllib.request

BASE = 'd:/workbuddy-workplace/.toolchain'
DEST = os.path.join(BASE, 'node22')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    if os.path.isfile(os.path.join(DEST, '.ok')):
        print('SKIP node22 already installed')
        return
    idx = json.loads(get('https://nodejs.org/dist/index.json'))
    cand = None
    for item in idx:
        v = item.get('version', '')
        if v.startswith('v22.') and 'win-x64-zip' in item.get('files', []):
            cand = item
            break
    if not cand:
        print('no v22 win-x64 zip found')
        return
    ver = cand['version']
    url = 'https://nodejs.org/dist/%s/node-%s-win-x64.zip' % (ver, ver)
    print('downloading', url)
    data = get(url)
    print('got', len(data))
    tmp = os.path.join(BASE, 'node22.zip')
    with open(tmp, 'wb') as f:
        f.write(data)
    if os.path.isdir(DEST):
        import shutil
        shutil.rmtree(DEST, ignore_errors=True)
    with zipfile.ZipFile(tmp) as z:
        z.extractall(DEST)
    os.remove(tmp)
    with open(os.path.join(DEST, '.ok'), 'w') as f:
        f.write('ok')
    print('OK node22', ver, '->', DEST)


if __name__ == '__main__':
    main()
