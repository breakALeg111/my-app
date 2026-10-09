(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui, cos = App.cosync;
  var els = {};
  var deferredPrompt = null;

  function init() {
    els.stDiary = document.getElementById('stDiary');
    els.stEvents = document.getElementById('stEvents');
    els.stCare = document.getElementById('stCare');
    els.stBackend = document.getElementById('stBackend');
    els.stSize = document.getElementById('stSize');
    els.stBackup = document.getElementById('stBackup');
    els.cosProvider = document.getElementById('cosProvider');
    els.cosAk = document.getElementById('cosAk');
    els.cosSk = document.getElementById('cosSk');
    els.cosBucket = document.getElementById('cosBucket');
    els.cosRegion = document.getElementById('cosRegion');
    els.cosKey = document.getElementById('cosKey');
    els.cosAuto = document.getElementById('cosAuto');
    els.cosState = document.getElementById('cosState');
    els.cosAkLabel = document.getElementById('cosAkLabel');
    els.cosSkLabel = document.getElementById('cosSkLabel');
    els.cosRegionLabel = document.getElementById('cosRegionLabel');

    document.getElementById('exportBackup').addEventListener('click', exportBackup);
    document.getElementById('importBackup').addEventListener('click', importBackup);
    document.getElementById('clearAll').addEventListener('click', clearAll);

    var c = cos.cfg();
    els.cosProvider.value = c.provider || 'cos';
    els.cosAk.value = c.ak || '';
    els.cosSk.value = c.sk || '';
    els.cosBucket.value = c.bucket || '';
    els.cosRegion.value = c.region || '';
    els.cosKey.value = c.key || 'daily-hub/backup.json';
    els.cosAuto.checked = !!c.auto;
    syncCosLabels();

    ['cosAk', 'cosSk', 'cosBucket', 'cosRegion', 'cosKey'].forEach(function (id) {
      els[id].addEventListener('change', collectCosCfg);
    });
    els.cosProvider.addEventListener('change', function () {
      collectCosCfg();
      syncCosLabels();
    });
    els.cosAuto.addEventListener('change', function () {
      cos.saveCfg({ auto: els.cosAuto.checked });
      ui.toast(els.cosAuto.checked ? '已开启自动备份' : '已关闭自动备份');
    });
    document.getElementById('cosTest').addEventListener('click', cosTest);
    document.getElementById('cosBackup').addEventListener('click', cosBackup);
    document.getElementById('cosRestore').addEventListener('click', cosRestore);

    bindInstall();

    renderInfo();
  }

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function fmtAgo(ts) {
    if (!ts) return '从未备份';
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  }

  function renderInfo() {
    els.stDiary.textContent = store.diary.count() + ' 天';
    els.stEvents.textContent = store.events.all().length + ' 个';
    els.stCare.textContent = store.care.items().length + ' 项';
    els.stSize.textContent = fmtSize(store.sizeBytes());
    els.stBackup.textContent = fmtAgo(store.state.settings.lastBackupAt);

    App.storage.backendName().then(function (name) { els.stBackend.textContent = name; });
    App.storage.estimate().then(function (e) {
      if (e && e.quota) els.stSize.textContent = fmtSize(store.sizeBytes()) + ' / 可用 ' + fmtSize(e.quota);
    });

    refreshCosState();
  }

  /* ---------------- 对象存储同步 ---------------- */

  function collectCosCfg() {
    cos.saveCfg({
      provider: els.cosProvider.value,
      ak: els.cosAk.value.trim(),
      sk: els.cosSk.value.trim(),
      bucket: els.cosBucket.value.trim(),
      region: els.cosRegion.value.trim(),
      key: els.cosKey.value.trim() || 'daily-hub/backup.json'
    });
    refreshCosState();
  }

  function syncCosLabels() {
    var isOss = els.cosProvider.value === 'oss';
    els.cosAkLabel.textContent = isOss ? 'AccessKeyId' : 'SecretId';
    els.cosSkLabel.textContent = isOss ? 'AccessKeySecret' : 'SecretKey';
    els.cosRegionLabel.textContent = isOss ? '地域 Endpoint' : '地域 Region';
    els.cosRegion.placeholder = isOss ? 'oss-cn-hangzhou' : 'ap-guangzhou';
    els.cosAk.placeholder = isOss ? 'LTAIxxxxxxxx' : 'AKIDxxxxxxxx';
  }

  function refreshCosState(text) {
    if (text) { els.cosState.textContent = text; return; }
    var c = cos.cfg();
    els.cosState.textContent = c.ak && c.bucket
      ? ((c.provider === 'oss' ? 'OSS' : 'COS') + (c.auto ? ' · 自动备份开' : ' · 已配置'))
      : '未配置';
  }

  function cosTest() {
    collectCosCfg();
    refreshCosState('测试中…');
    cos.test(cos.cfg()).then(function (r) {
      refreshCosState(r.exist ? '已连接 · 云端有备份' : '已连接 · 云端暂无备份');
      ui.toast('连接成功', 'ok');
    }, function (err) {
      refreshCosState('连接失败');
      ui.toast(err.message, 'error');
    });
  }

  function cosBackup() {
    collectCosCfg();
    refreshCosState('备份中…');
    cos.upload(cos.cfg(), JSON.stringify(buildBackup(), null, 2)).then(function () {
      markBackup();
      refreshCosState('已备份 · ' + fmtAgo(Date.now()));
      ui.toast('已备份到云端', 'ok');
    }, function (err) {
      refreshCosState('备份失败');
      ui.toast(err.message, 'error');
    });
  }

  function cosRestore() {
    collectCosCfg();
    refreshCosState('下载中…');
    cos.download(cos.cfg()).then(function (text) {
      if (!text) {
        refreshCosState('云端暂无备份');
        ui.toast('云端还没有备份文件', 'error');
        return;
      }
      var obj;
      try { obj = JSON.parse(text); } catch (e) { ui.toast('云端备份不是有效的 JSON', 'error'); return; }
      refreshCosState();
      applyBackup(obj, '云端');
    }, function (err) {
      refreshCosState('下载失败');
      ui.toast(err.message, 'error');
    });
  }

  /* ---------------- 安装到桌面 ---------------- */

  function bindInstall() {
    var btn = document.getElementById('btnInstall');
    var hint = document.getElementById('installHint');
    if (!btn) return;

    function isStandalone() {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function refresh() {
      if (isStandalone()) {
        btn.style.display = 'none';
        hint.textContent = '已作为应用运行（全屏、可离线）。';
        return;
      }
      if (deferredPrompt) {
        btn.style.display = '';
        btn.textContent = '安装到手机桌面';
        hint.textContent = '点击后按系统提示确认，桌面会出现图标。';
      } else {
        btn.style.display = 'none';
        hint.textContent = '当前浏览器未触发安装：Android Chrome 可用菜单「安装应用 / 添加到主屏幕」；iPhone 请用 Safari 的分享 → 添加到主屏幕。';
      }
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      refresh();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      refresh();
    });

    btn.addEventListener('click', function () {
      if (!deferredPrompt) { refresh(); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        refresh();
      });
    });

    refresh();
  }

  /* ---------------- 备份文件 ---------------- */

  function buildBackup() {
    return {
      app: 'daily-hub',
      type: 'all',
      version: 1,
      exportedAt: new Date().toISOString(),
      diary: store.state.diary,
      events: store.state.events,
      maintenance: store.state.maintenance
    };
  }

  function markBackup() {
    store.state.settings.lastBackupAt = Date.now();
    store.save();
    renderInfo();
  }

  function exportBackup() {
    var payload = buildBackup();
    if (U.download('backup-' + U.todayStr() + '.json', JSON.stringify(payload, null, 2))) {
      markBackup();
      ui.toast('备份文件已生成', 'ok');
    } else {
      ui.toast('导出失败', 'error');
    }
  }

  function importBackup() {
    U.pickFile('.json').then(function (file) {
      if (!file) return;
      var obj;
      try { obj = JSON.parse(file.text); } catch (e) { ui.toast('不是有效的 JSON 备份', 'error'); return; }
      if (!obj || typeof obj !== 'object') { ui.toast('文件内容无法识别', 'error'); return; }
      applyBackup(obj, '备份文件');
    });
  }

  /** 统一的备份应用流程（文件 / 云端共用） */
  function applyBackup(obj, source) {
    var hasDiary = obj.diary && typeof obj.diary === 'object' && Object.keys(obj.diary).length;
    var hasEvents = Array.isArray(obj.events) && obj.events.length;
    var hasCare = obj.maintenance && Array.isArray(obj.maintenance.items) && obj.maintenance.items.length;
    var summary = [
      hasDiary ? Object.keys(obj.diary).length + ' 条日志' : '',
      hasEvents ? obj.events.length + ' 个日子' : '',
      hasCare ? obj.maintenance.items.length + ' 个保养项目' : ''
    ].filter(Boolean).join('，') || '（无可识别数据）';

    ui.choice({
      title: '恢复数据',
      message: '来自' + source + '：' + summary + '。请选择方式：',
      options: [
        { text: '合并到现有数据', value: 'merge', primary: true },
        { text: '覆盖现有全部数据', value: 'replace' }
      ]
    }).then(function (mode) {
      if (!mode) return;
      if (mode === 'replace') store.replace(obj);
      else mergeInto(obj);
      App.refreshAll();
      renderInfo();
      ui.toast('恢复完成', 'ok');
    });
  }

  function mergeInto(obj) {
    if (obj.diary && typeof obj.diary === 'object') {
      Object.keys(obj.diary).forEach(function (d) {
        if (!U.isValidDate(d)) return;
        var v = obj.diary[d];
        var content = typeof v === 'string' ? v : (v && v.content) || '';
        if (content) store.state.diary[d] = { content: content, updatedAt: (v && v.updatedAt) || Date.now() };
      });
    }
    if (Array.isArray(obj.events)) {
      var existEvents = {};
      store.state.events.forEach(function (e) { existEvents[e.title + '|' + e.date] = true; });
      obj.events.forEach(function (e) {
        if (!e || !U.isValidDate(e.date)) return;
        if (existEvents[e.title + '|' + e.date]) return;
        store.state.events.push({
          id: U.uid(),
          title: String(e.title || '未命名'),
          date: e.date,
          note: e.note ? String(e.note) : '',
          createdAt: e.createdAt || Date.now()
        });
      });
    }
    if (obj.maintenance) {
      if (obj.maintenance.mileage) {
        store.state.maintenance.mileage = Math.max(store.state.maintenance.mileage, Number(obj.maintenance.mileage) || 0);
      }
      if (Array.isArray(obj.maintenance.items)) {
        var existNames = {};
        store.state.maintenance.items.forEach(function (i) { existNames[i.name] = true; });
        obj.maintenance.items.forEach(function (i) {
          if (!i || existNames[i.name]) return;
          store.state.maintenance.items.push({
            id: U.uid(),
            name: String(i.name || '未命名项目'),
            intervalKm: Number(i.intervalKm) || 0,
            intervalValue: Number(i.intervalValue) || 0,
            intervalUnit: i.intervalUnit === 'day' ? 'day' : 'month',
            lastKm: Number(i.lastKm) || 0,
            lastDate: U.isValidDate(i.lastDate) ? i.lastDate : U.todayStr(),
            note: i.note ? String(i.note) : '',
            createdAt: Date.now()
          });
        });
      }
    }
    store.save();
  }

  /** 自动备份：每天首次打开时触发一次 */
  function maybeAutoBackup() {
    var last = store.state.settings.lastBackupAt || 0;
    if (Date.now() - last < 20 * 3600 * 1000) return;   // 20 小时内已备份过则跳过

    var c = cos.cfg();
    if (c.auto && c.ak && c.bucket) {
      cos.upload(c, JSON.stringify(buildBackup(), null, 2)).then(function () {
        markBackup();
        ui.toast('已自动备份到云端', 'ok');
      }, function () { /* 自动备份失败不打扰用户 */ });
    }
  }

  function clearAll() {
    ui.confirm({
      title: '清空所有数据',
      message: '将删除全部日志、倒数日和保养项目，且无法恢复。建议先做一次备份。',
      danger: true,
      okText: '确认清空'
    }).then(function (ok) {
      if (!ok) return;
      store.replace({});
      App.refreshAll();
      renderInfo();
      ui.toast('已清空');
    });
  }

  App.settings = { init: init, renderInfo: renderInfo, maybeAutoBackup: maybeAutoBackup };
})(window.App);
