(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui;
  var els = {};
  var current = U.todayStr();
  var focusYM = null;   // 筛选焦点，格式 YYYY-MM

  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return U.dateToStr(d) + ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  }

  function init() {
    els.date = document.getElementById('diaryDate');
    els.week = document.getElementById('diaryWeek');
    els.big = document.getElementById('dateBig');
    els.dateYear = document.getElementById('dateYear');
    els.input = document.getElementById('diaryInput');
    els.head = document.getElementById('diaryHeadLabel');
    els.badge = document.getElementById('diaryBadge');
    els.meta = document.getElementById('diaryMeta');
    els.savedAt = document.getElementById('diarySavedAt');
    els.list = document.getElementById('diaryList');
    els.count = document.getElementById('diaryCount');
    els.search = document.getElementById('diarySearch');
    els.scope = document.getElementById('logScope');
    els.period = document.getElementById('logPeriod');
    els.prev = document.getElementById('logPrev');
    els.next = document.getElementById('logNext');

    els.date.value = current;

    document.getElementById('prevDay').addEventListener('click', function () {
      go(U.addDays(current, -1));
    });
    document.getElementById('nextDay').addEventListener('click', function () {
      go(U.addDays(current, 1));
    });
    document.getElementById('todayBtn').addEventListener('click', function () {
      go(U.todayStr());
    });
    els.date.addEventListener('change', function () {
      if (U.isValidDate(els.date.value)) go(els.date.value);
      else els.date.value = current;
    });
    // 点击展示块时唤起系统日期选择器
    els.date.addEventListener('click', function () {
      if (typeof els.date.showPicker === 'function') {
        try { els.date.showPicker(); return; } catch (e) { /* 忽略，退化为聚焦 */ }
      }
      els.date.focus();
    });

    els.input.addEventListener('input', function () {
      refreshMeta();
      autoSave();
    });

    document.getElementById('diarySave').addEventListener('click', function () {
      flushSave(true);
    });
    document.getElementById('diaryDelete').addEventListener('click', function () {
      var content = store.diary.get(current);
      if (!content) { ui.toast('本日还没有日志', 'error'); return; }
      ui.confirm({ title: '删除日志', message: '确定删除 ' + current + ' 的工作日志吗？', danger: true, okText: '删除' })
        .then(function (ok) {
          if (!ok) return;
          store.diary.remove(current);
          els.input.value = '';
          render();
          ui.toast('已删除');
        });
    });

    els.search.addEventListener('input', U.debounce(function () { renderList(); }, 200));

    initFilters();
    render();
  }

  /* ---------- 历史日志筛选：按月份（默认） / 按季度 / 全部 ---------- */

  function initFilters() {
    els.scope.value = 'month';
    focusYM = U.todayStr().slice(0, 7);

    els.scope.addEventListener('change', function () {
      fillPeriodOptions();
      syncFilterUI();
      renderList();
    });
    els.period.addEventListener('change', function () {
      updateFocus();
      renderList();
    });
    els.prev.addEventListener('click', function () { stepPeriod(-1); });
    els.next.addEventListener('click', function () { stepPeriod(1); });

    fillPeriodOptions();
    syncFilterUI();
  }

  /** 生成可选时间段（月份：近 36 个月；季度：近 16 个季度） */
  function periodList(scope) {
    var now = new Date();
    var list = [];
    var i, d;
    if (scope === 'month') {
      for (i = 0; i < 36; i++) {
        d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push({
          ym: d.getFullYear() + '-' + U.pad(d.getMonth() + 1),
          value: d.getFullYear() + '-' + U.pad(d.getMonth() + 1),
          label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月'
        });
      }
    } else {
      for (i = 0; i < 16; i++) {
        d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
        var ym = d.getFullYear() + '-' + U.pad(d.getMonth() + 1);
        var q = U.quarterOf(ym + '-01').q;
        list.push({ ym: ym, value: d.getFullYear() + '-' + q, label: d.getFullYear() + '年 第' + q + '季度' });
      }
    }
    return list;
  }

  function fillPeriodOptions() {
    var scope = els.scope.value;
    if (scope === 'all') { els.period.innerHTML = ''; return; }

    var list = periodList(scope);
    els.period.innerHTML = list.map(function (o) {
      return '<option value="' + o.value + '">' + o.label + '</option>';
    }).join('');

    var want = focusYM || U.todayStr().slice(0, 7);
    var target = scope === 'month'
      ? want
      : (want.slice(0, 4) + '-' + U.quarterOf(want + '-01').q);
    var idx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].value === target) { idx = i; break; }
    }
    els.period.selectedIndex = idx;
    updateFocus();
  }

  /** 由当前选中的时间段反推焦点月份 */
  function updateFocus() {
    var scope = els.scope.value;
    if (scope === 'all') return;
    var v = els.period.value;
    if (!v) return;
    var p = v.split('-');
    focusYM = scope === 'month' ? v : (p[0] + '-' + U.pad((+p[1] - 1) * 3 + 1));
  }

  function stepPeriod(delta) {
    if (els.scope.value === 'all' || !els.period.options.length) return;
    var idx = els.period.selectedIndex - delta;
    if (idx < 0 || idx >= els.period.options.length) {
      ui.toast(delta < 0 ? '已经是更早的记录了' : '没有更晚的记录了');
      return;
    }
    els.period.selectedIndex = idx;
    updateFocus();
    renderList();
  }

  function syncFilterUI() {
    var scope = els.scope.value;
    var visible = scope !== 'all';
    els.period.classList.toggle('hidden', !visible);
    els.prev.classList.toggle('hidden', !visible);
    els.next.classList.toggle('hidden', !visible);
  }

  /** 当前筛选范围的起止日期与标题 */
  function scopeInfo() {
    var scope = els.scope.value;
    if (scope === 'all') return { start: '0000-01-01', end: '9999-12-31', label: '全部' };

    var p = els.period.value.split('-');
    var y = +p[0];
    if (scope === 'month') {
      var m = +p[1];
      var lastDay = new Date(y, m, 0).getDate();
      return {
        start: y + '-' + U.pad(m) + '-01',
        end: y + '-' + U.pad(m) + '-' + U.pad(lastDay),
        label: y + '年' + m + '月'
      };
    }
    var q = +p[1];
    var r = U.quarterRange(y, q);
    return { start: r.start, end: r.end, label: y + '年 第' + q + '季度' };
  }

  var autoSave = U.debounce(function () { flushSave(false); }, 900);

  function flushSave(manual) {
    var value = els.input.value;
    var existed = store.diary.get(current);
    if (value === existed) {
      if (manual) ui.toast('内容没有变化');
      return;
    }
    store.diary.set(current, value);
    refreshMeta();
    refreshBadge();
    renderList();
    if (manual) ui.toast(value.trim() ? '已保存' : '已清空', 'ok');
  }

  function go(date) {
    flushSave(false);            // 离开当天前先落盘
    current = date;
    els.date.value = date;
    render();
  }

  function render() {
    els.input.value = store.diary.get(current);
    els.head.textContent = current === U.todayStr() ? '今日日志' : (U.fmtDateCN(current) + ' 日志');
    refreshBadge();
    refreshMeta();
    refreshDateBar();
    renderList();
  }

  function refreshDateBar() {
    var diff = U.diffDays(U.todayStr(), current);
    var rel = diff === 0 ? '今天' : (diff === 1 ? '明天' : (diff === -1 ? '昨天' : ''));
    var week = U.weekday(current);
    els.week.innerHTML = U.esc(week) + (rel ? ' · <span class="today-chip">' + rel + '</span>' : '');
    els.big.textContent = (+current.slice(5, 7)) + '月' + (+current.slice(8, 10)) + '日';
    els.dateYear.textContent = current.slice(0, 4) + ' 年';
  }

  function refreshBadge() {
    var has = !!store.diary.get(current);
    els.badge.textContent = has ? '已记录' : '未记录';
    els.badge.className = 'badge' + (has ? '' : ' is-empty');
    var entry = store.state.diary[current];
    els.savedAt.textContent = entry && entry.updatedAt ? '更新于 ' + fmtTime(entry.updatedAt) : '内容会自动保存';
  }

  function refreshMeta() {
    els.meta.textContent = els.input.value.length + ' 字';
  }

  function renderList() {
    var kw = (els.search.value || '').trim().toLowerCase();
    var scope = scopeInfo();
    var total = store.diary.count();

    var dates = store.diary.sortedDates().filter(function (d) {
      return d >= scope.start && d <= scope.end;
    });
    var inScope = dates.length;

    var shown = [];
    for (var i = 0; i < dates.length; i++) {
      var d = dates[i];
      if (!kw || d.indexOf(kw) >= 0 || store.diary.get(d).toLowerCase().indexOf(kw) >= 0) shown.push(d);
    }

    els.count.textContent = (scope.label === '全部'
      ? ('共 ' + total + ' 天')
      : (scope.label + ' · ' + inScope + ' 天 / 共 ' + total + ' 天')) + (kw ? '，匹配 ' + shown.length + ' 天' : '');

    if (!shown.length) {
      var msg = '还没有任何日志，从今天开始记录吧';
      if (total) {
        if (inScope === 0) msg = scope.label + '没有日志记录';
        else if (kw) msg = '没有匹配的日志';
      }
      els.list.innerHTML = '<div class="empty">' + msg + '</div>';
      return;
    }

    var html = '';
    var lastYM = '';
    var groupCount = 0;
    var todayStr = U.todayStr();

    function closeGroup() {
      if (!lastYM) return;
      html += '<div class="group-head"><span>' + lastYM + '</span><span>' + groupCount + ' 天</span></div>';
    }

    shown.slice(0, 300).forEach(function (d) {
      var ym = d.slice(0, 4) + '年' + (+d.slice(5, 7)) + '月';
      if (ym !== lastYM) {
        closeGroup();
        lastYM = ym;
        groupCount = 0;
      }
      groupCount++;
      var label = d === todayStr ? '今天' : U.weekday(d);
      html += '<div class="list-item log-item" data-date="' + d + '">' +
        '<div class="log-date"><span>' + U.fmtDateCN(d) + '</span><small>' + label + '</small></div>' +
        '<div class="log-text">' + U.esc(store.diary.get(d)) + '</div>' +
        '</div>';
    });
    closeGroup();

    els.list.innerHTML = html;

    els.list.querySelectorAll('.log-item').forEach(function (node) {
      node.addEventListener('click', function () {
        go(node.getAttribute('data-date'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  App.diary = {
    init: init,
    refresh: renderList,
    renderAll: render,
    /** 导入新日志后刷新筛选（不重复绑定事件） */
    refreshFilters: function () {
      fillPeriodOptions();
      syncFilterUI();
      renderList();
    }
  };
})(window.App);
