(function (App) {
  'use strict';

  var U = App.utils, store = App.store;

  /* 对象存储同步：腾讯云 COS / 阿里云 OSS
   * SDK 已内置在 vendor/ 下，按需加载，避免首屏变慢。
   * 上传走 SDK（自动签名），下载/检测用签名 URL + fetch。
   */
  var SDK_FILE = {
    cos: 'vendor/cos-js-sdk-v5.min.js',
    oss: 'vendor/aliyun-oss-sdk.min.js'
  };
  var SDK_GLOBAL = { cos: 'COS', oss: 'OSS' };
  var sdkCache = {};

  function cfg() { return store.state.settings.cos || {}; }

  function saveCfg(patch) {
    var c = cfg();
    Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
    store.save();
  }

  function loadSDK(provider) {
    if (sdkCache[provider]) return sdkCache[provider];
    var name = SDK_GLOBAL[provider] || SDK_GLOBAL.cos;
    if (window[name]) {
      sdkCache[provider] = Promise.resolve(window[name]);
      return sdkCache[provider];
    }
    sdkCache[provider] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK_FILE[provider];
      s.onload = function () { resolve(window[name] || null); };
      s.onerror = function () {
        sdkCache[provider] = null;
        reject(new Error('云存储 SDK 加载失败（' + SDK_FILE[provider] + '），请确认文件存在'));
      };
      document.head.appendChild(s);
    });
    return sdkCache[provider];
  }

  function keyOf(c) { return (c && c.key) ? c.key : 'daily-hub/backup.json'; }

  function validate(c) {
    var msg = null;
    if (!c.ak || !c.sk) msg = '请先填写密钥（SecretId / SecretKey）';
    else if (!c.bucket) msg = '请先填写存储桶名称';
    else if (!c.region) msg = '请先填写地域';
    if (msg) {
      var e = new Error(msg);
      e.friendly = true;          // 直接展示给用户的提示，不做二次包装
      throw e;
    }
  }

  function newClient(SDK, c) {
    if (c.provider === 'oss') {
      return new SDK({ region: c.region, accessKeyId: c.ak, accessKeySecret: c.sk, bucket: c.bucket, secure: true });
    }
    return new SDK({ SecretId: c.ak, SecretKey: c.sk });
  }

  function upload(c, text) {
    // 统一转成 Promise 拒绝，避免同步抛出导致调用方漏捕获
    return Promise.resolve().then(function () {
      validate(c);
      return loadSDK(c.provider).then(function (SDK) {
        if (!SDK) throw new Error('SDK 未加载');
        if (c.provider === 'oss') {
          var client = newClient(SDK, c);
          return client.put(keyOf(c), new Blob([text], { type: 'application/json;charset=utf-8' }));
        }
        return new Promise(function (resolve, reject) {
          var cos = newClient(SDK, c);
          cos.putObject({
            Bucket: c.bucket,
            Region: c.region,
            Key: keyOf(c),
            Body: text,
            ContentType: 'application/json;charset=utf-8'
          }, function (err, data) {
            if (err) reject(err); else resolve(data);
          });
        });
      });
    }).catch(function (err) {
      throw normalizeError(err);
    });
  }

  /** 生成带签名的临时下载链接（15 分钟有效） */
  function signedUrl(c) {
    return Promise.resolve().then(function () {
      validate(c);
      return loadSDK(c.provider).then(function (SDK) {
        if (!SDK) throw new Error('SDK 未加载');
        var client = newClient(SDK, c);
        if (c.provider === 'oss') return client.signatureUrl(keyOf(c), { expires: 900 });
        return client.getObjectUrl({ Bucket: c.bucket, Region: c.region, Key: keyOf(c), Sign: true, Expires: 900 });
      });
    });
  }

  /** 下载备份文本，不存在返回 null */
  function download(c) {
    return signedUrl(c).then(function (url) {
      return fetch(url, { method: 'GET' }).then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw httpError(res.status);
        return res.text();
      }, function (err) {
        throw netError(err);
      });
    }).catch(function (err) {
      throw normalizeError(err);
    });
  }

  /** 测试连接：能拿到 200/404 即视为配置正确 */
  function test(c) {
    return download(c).then(function (text) {
      return { ok: true, exist: !!text };
    });
  }

  function httpError(status) {
    var e = new Error(
      status === 403 ? '访问被拒绝：密钥无权访问该文件，或跨域(CORS)规则未放行。' :
      status === 401 ? '签名无效，请检查密钥是否正确。' :
      status === 404 ? '文件不存在。' :
      '请求失败（HTTP ' + status + '）。'
    );
    e.status = status;
    return e;
  }

  function netError(err) {
    var e = new Error('无法访问：网络错误或浏览器跨域被拒绝（' + ((err && err.message) || 'fetch failed') +
      '）。请在存储桶的跨域(CORS)设置里放行本站点来源，并允许 GET/PUT/HEAD。');
    e.status = 0;
    return e;
  }

  function normalizeError(err) {
    if (err && err.friendly) return err;
    if (err && (err.status === 0 || err.status)) return err;   // 已处理过
    var status = err && (err.statusCode || err.code);
    var msg = err && (err.message || err.error || err.Message);
    if (status === 403 || status === '403' || status === 'AccessDenied') {
      return httpError(403);
    }
    if (status === 404 || status === 'NoSuchKey') return httpError(404);
    var e = new Error(msg ? ('操作失败：' + msg) : '操作失败');
    e.status = Number(status) || 0;
    return e;
  }

  App.cosync = {
    cfg: cfg,
    saveCfg: saveCfg,
    loadSDK: loadSDK,
    keyOf: keyOf,
    upload: upload,
    download: download,
    signedUrl: signedUrl,
    test: test
  };
})(window.App);
