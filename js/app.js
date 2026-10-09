(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui;
  var currentView = 'diary';

  var TITLES = {
    diary: '工作日志',
    events: '倒数日 / 正数日',
    care: '保养提醒',
    settings: '设置与备份'
  };

  function init() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTo(tab.getAttribute('data-view'));
      });
    });

    // 数据层为 IndexedDB，需异步载入后再初始化各模块
    store.load().then(function () {
      App.diary.init();
      App.events.init();
      App.care.init();
      App.dataio.init();
      App.settings.init();

      // 支持 ?tab=xxx 直达（桌面快捷方式 / manifest shortcuts）
      var tabParam = null;
      try { tabParam = new URLSearchParams(location.search).get('tab'); } catch (e) { tabParam = null; }
      switchTo(tabParam && TITLES[tabParam] ? tabParam : (store.state.settings.tab || 'diary'));
      App.settings.maybeAutoBackup();
    });

    // 跨天 / 长时间停留后自动刷新
    var day = U.todayStr();
    setInterval(function () {
      var now = U.todayStr();
      if (now !== day) { day = now; App.refreshAll(); }
    }, 60000);

    // 页面隐藏/关闭前尽量把未落盘的数据写入
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') store.flush();
    });
    window.addEventListener('pagehide', function () { store.flush(); });

    registerSW();
  }

  function switchTo(view) {
    if (!TITLES[view]) view = 'diary';
    currentView = view;
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-view') === view);
    });
    document.getElementById('pageTitle').textContent = TITLES[view];
    store.state.settings.tab = view;
    store.save();
    updateSub();
  }

  function updateSub() {
    var sub = '';
    if (currentView === 'diary') {
      sub = '已记录 ' + store.diary.count() + ' 天';
    } else if (currentView === 'events') {
      var n = store.events.all().length;
      if (n) {
        var today = U.todayStr(), future = 0, past = 0;
        store.events.all().forEach(function (e) {
          if (U.diffDays(today, e.date) >= 0) future++; else past++;
        });
        sub = '共 ' + n + ' 个 · 未来 ' + future + ' · 已过 ' + past;
      }
    } else if (currentView === 'settings') {
      sub = '数据备份、网盘同步';
    } else {
      var items = store.care.items();
      var warn = 0, over = 0;
      items.forEach(function (it) {
        var s = store.care.status(it);
        if (s.status === 'over') over++;
        else if (s.status === 'warn') warn++;
      });
      sub = items.length ? ('当前 ' + U.num(store.care.mileage()) + ' km' + (over ? ' · ' + over + ' 项超期' : '') + (warn ? ' · ' + warn + ' 项临近' : '')) : '';
      if (items.length && !over && !warn) sub += ' · 全部安全';
    }
    document.getElementById('pageSub').textContent = sub;
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) return;   // file:// 或 http 局域网下不注册，不影响功能
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('Service Worker 注册失败', e);
      });
    });
  }

  App.refreshAll = function () {
    App.diary.renderAll();
    if (App.diary.refreshFilters) App.diary.refreshFilters();
    App.events.render();
    App.care.renderMileage();
    App.care.render();
    if (App.settings && App.settings.renderInfo) App.settings.renderInfo();
    updateSub();
  };

  App.switchTo = switchTo;
  App.updateSub = updateSub;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.App);
