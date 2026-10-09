(function (App) {
  'use strict';

  /* 原生能力：状态栏配色、启动图、返回键、本地通知
     在浏览器中自动降级为不执行任何操作。 */

  var C = window.capacitorExports && window.capacitorExports.Capacitor;
  var plugins = null;
  var lastBack = 0;

  function isNative() {
    return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  }

  function get() {
    if (!isNative()) return null;
    if (!plugins) {
      plugins = {
        StatusBar: C.registerPlugin('StatusBar'),
        SplashScreen: C.registerPlugin('SplashScreen'),
        App: C.registerPlugin('App'),
        LocalNotifications: C.registerPlugin('LocalNotifications')
      };
    }
    return plugins;
  }

  function init() {
    if (!isNative()) return;
    var p = get();
    if (!p) return;

    applyStatusBar();
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyStatusBar);
    else if (mq.addListener) mq.addListener(applyStatusBar);

    try { p.SplashScreen.hide({ fadeOutDuration: 200 }); } catch (e) { /* 忽略 */ }

    if (p.App && p.App.addListener) {
      p.App.addListener('backButton', function () {
        // 1. 有弹层先关弹层
        if (App.ui && App.ui.isModalOpen && App.ui.isModalOpen()) {
          App.ui.closeModal();
          return;
        }
        // 2. 不在首页则回到首页
        var tab = App.currentView ? App.currentView() : 'diary';
        if (tab !== 'diary') {
          App.switchTo('diary');
          return;
        }
        // 3. 首页连按两次退出
        var now = Date.now();
        if (now - lastBack < 2000) {
          try { p.App.exitApp(); } catch (e) { /* 忽略 */ }
          return;
        }
        lastBack = now;
        App.ui.toast('再按一次退出应用');
      });
    }

    refresh();
  }

  function applyStatusBar() {
    var p = get();
    if (!p || !p.StatusBar) return;
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    try {
      p.StatusBar.setOverlaysWebView({ overlay: false });
      // Style：DARK 表示浅色文字（深色背景），LIGHT 表示深色文字（浅色背景）
      p.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' });
      p.StatusBar.setBackgroundColor({ color: dark ? '#12141A' : '#F4F5FA' });
    } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 本地通知 ---------------- */

  function at(hour, minute, dayOffset) {
    var d = new Date();
    d.setDate(d.getDate() + (dayOffset || 0));
    d.setHours(hour || 9, minute || 0, 0, 0);
    return d;
  }

  /** 下一个 9:00（今天已过则明天） */
  function nextNine() {
    var d = at(9, 0, 0);
    if (d.getTime() - Date.now() < 60000) d = at(9, 0, 1);
    return d;
  }

  function buildList() {
    var U = App.utils, store = App.store;
    var today = U.todayStr();
    var list = [];

    var over = [], warn = [];
    store.care.items().forEach(function (it) {
      var s = store.care.status(it);
      if (s.status === 'over') over.push(it.name);
      else if (s.status === 'warn') warn.push(it.name);
    });
    if (over.length) {
      list.push({
        id: 3001, title: '保养已超期',
        body: over.join('、') + ' 已超过保养周期，尽快处理',
        schedule: { at: nextNine() }
      });
    } else if (warn.length) {
      list.push({
        id: 3002, title: '保养临近',
        body: warn.join('、') + ' 即将到达保养周期',
        schedule: { at: nextNine() }
      });
    }

    var todayTitles = [];
    store.events.all().forEach(function (e, i) {
      var days = U.diffDays(today, e.date);
      if (days === 0) {
        todayTitles.push(e.title);
        list.push({
          id: 4000 + i, title: '今天是「' + e.title + '」',
          body: '就是你设定的日子',
          schedule: { at: nextNine() }
        });
      } else if (days === 1) {
        list.push({
          id: 4100 + i, title: '明天是「' + e.title + '」',
          body: '还有 1 天',
          schedule: { at: nextNine() }
        });
      }
    });

    var summary = [];
    if (over.length) summary.push(over.length + ' 项保养超期');
    else if (warn.length) summary.push(warn.length + ' 项保养临近');
    if (todayTitles.length) summary.push('今天是 ' + todayTitles.join('、'));
    if (summary.length) {
      list.push({
        id: 2000, title: '今日提醒',
        body: summary.join('；'),
        schedule: { every: 'day', hour: 9, minute: 0 }
      });
    }
    return list;
  }

  /** 根据当前数据重建通知（先清后建） */
  function refresh() {
    var p = get();
    if (!p || !p.LocalNotifications) return Promise.resolve(false);
    var ln = p.LocalNotifications;

    return ln.getPending().then(function (res) {
      var ids = ((res && res.notifications) || []).map(function (n) { return { id: n.id }; });
      if (ids.length) return ln.cancel({ notifications: ids });
      return null;
    }).catch(function () { return null; }).then(function () {
      if (!App.store.state.settings.notify) return false;
      var list = buildList();
      if (!list.length) return false;
      return ln.schedule({ notifications: list }).then(function () { return true; });
    }).catch(function () { return false; });
  }

  /** 发送一条测试通知（5 秒后） */
  function test() {
    var p = get();
    if (!p || !p.LocalNotifications) {
      App.ui.toast('当前不是原生环境', 'error');
      return;
    }
    p.LocalNotifications.requestPermissions().then(function (r) {
      if (!r || r.display !== 'granted') {
        App.ui.toast('通知权限未开启', 'error');
        return;
      }
      return p.LocalNotifications.schedule({
        notifications: [{
          id: 9999, title: '测试提醒', body: '来自日常助手的本地通知',
          schedule: { at: new Date(Date.now() + 5000) }
        }]
      }).then(function () { App.ui.toast('5 秒后发出测试通知', 'ok'); });
    }).catch(function (e) {
      App.ui.toast('发送失败：' + (e && e.message ? e.message : e), 'error');
    });
  }

  App.native = {
    isNative: isNative,
    init: init,
    refresh: refresh,
    test: test
  };
})(window.App);
