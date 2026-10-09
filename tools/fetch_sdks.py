# -*- coding: utf-8 -*-
"""下载/更新云存储官方浏览器 SDK 到 vendor 目录（避免运行时依赖 CDN）。

用法：python tools/fetch_sdks.py
产出：
  vendor/cos-js-sdk-v5.min.js    腾讯云 COS
  vendor/aliyun-oss-sdk.min.js   阿里云 OSS
"""
import io
import json
import os
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, 'vendor')

TARGETS = [
    ('cos-js-sdk-v5', 'cos-js-sdk-v5.min.js', ['dist/cos-js-sdk-v5.min.js', 'dist/cos-js-sdk-v5.js']),
    ('ali-oss', 'aliyun-oss-sdk.min.js', ['dist/aliyun-oss-sdk.min.js', 'dist/aliyun-oss-sdk.js']),
]


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


if not os.path.isdir(VENDOR):
    os.makedirs(VENDOR)

for pkg, out_name, candidates in TARGETS:
    try:
        info = json.loads(get('https://registry.npmjs.org/' + pkg + '/latest'))
        data = get(info['dist']['tarball'])
        tf = tarfile.open(fileobj=io.BytesIO(data), mode='r:gz')
        names = tf.getnames()
        chosen = None
        for c in candidates:
            for n in names:
                if n.endswith(c):
                    chosen = n
                    break
            if chosen:
                break
        if not chosen:
            for n in names:
                if n.endswith('.js') and '/dist/' in n and 'map' not in n:
                    chosen = n
                    break
        if not chosen:
            print('SKIP', pkg, '未找到浏览器版本')
            continue
        content = tf.extractfile(chosen).read()
        with open(os.path.join(VENDOR, out_name), 'wb') as f:
            f.write(content)
        print('OK', pkg, info['version'], chosen, len(content), 'bytes')
    except Exception as e:
        print('FAIL', pkg, type(e).__name__, e)
