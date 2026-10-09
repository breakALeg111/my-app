(function (App) {
  'use strict';

  /* IndexedDB 封装：失败时自动回退 localStorage */
  var DB_NAME = 'dailyhub';
  var DB_VERSION = 1;
  var STORE = 'kv';
  var DATA_KEY = 'data';
  var LOCAL_KEY = 'dailyhub.data.v1';   // 旧版本使用的 localStorage 键

  var dbPromise = null;

  /** 打开数据库；1.5 秒内没有结果就认为不可用，回退 localStorage */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req;
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; resolve(null); }
      }, 1500);
      function done(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        done(null);
        return;
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { done(req.result); };
      req.onerror = function () { done(null); };
      req.onblocked = function () { done(null); };
    });
    return dbPromise;
  }

  function idbGet(key) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readonly');
          var req = tx.objectStore(STORE).get(key);
          req.onsuccess = function () { resolve(req.result === undefined ? null : req.result); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  function idbSet(key, value) {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(value, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  function localGet() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function localSet(value) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function get() {
    return openDB().then(function (db) {
      return db ? idbGet(DATA_KEY) : localGet();
    });
  }

  function set(value) {
    return openDB().then(function (db) {
      return db ? idbSet(DATA_KEY, value) : localSet(value);
    });
  }

  /** 读取旧版本 localStorage 数据（用于一次性迁移） */
  function readLegacy() { return localGet(); }

  /** 迁移完成后清掉旧的 localStorage 副本 */
  function clearLegacy() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* 忽略 */ }
  }

  function backendName() {
    return openDB().then(function (db) { return db ? 'IndexedDB' : 'localStorage（IndexedDB 不可用）'; });
  }

  /** 浏览器分配的存储用量（字节），不支持时返回 null */
  function estimate() {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (e) {
        return { usage: e.usage || 0, quota: e.quota || 0 };
      }).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  App.storage = {
    get: get,
    set: set,
    readLegacy: readLegacy,
    clearLegacy: clearLegacy,
    backendName: backendName,
    estimate: estimate
  };
})(window.App);
