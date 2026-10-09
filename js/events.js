(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui;
  var listEl, segEl;
  var GAP = 10;
  var filter = 'all';

  function init() {
    listEl = document.getElementById('eventList');
    segEl = document.getElementById('eventFilter');
    filter = store.state.settings.eventsFilter || 'all';

    document.getElementById('addEvent').addEventListener('click', function () { openForm(null); });

    segEl.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filter = btn.getAttribute('data-filter');
        store.state.settings.eventsFilter = filter;
        store.save();
        syncSeg();
        render();
      });
    });

    syncSeg();
    bindDrag();
    render();
  }

  function syncSeg() {
    segEl.querySelectorAll('.seg-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-filter') === filter);
    });
  }

  function render() {
    var today = U.todayStr();
    var all = store.events.all();

    var view = all.map(function (e, i) {
      return { e: e, index: i, days: U.diffDays(today, e.date) };
    });
    if (filter === 'future') view = view.filter(function (v) { return v.days >= 0; });
    else if (filter === 'past') view = view.filter(function (v) { return v.days < 0; });

    if (!view.length) {
      var msg = '还没有添加日子，点右上角「+ 添加」';
      if (all.length) msg = filter === 'future' ? '没有未来的日子' : '没有已过的日子';
      listEl.innerHTML = '<div class="empty">' + msg + '</div>';
      return;
    }

    var html = view.map(function (v) {
      var e = v.e, days = v.days;
      var isFuture = days > 0;
      var isToday = days === 0;
      var kind = isFuture || isToday ? 'future' : 'past';
      var numHtml = isToday
        ? '<b style="font-size:16px">就是今天</b><span>' + U.esc(e.date) + '</span>'
        : '<b>' + Math.abs(days) + '</b><span>' + (isFuture ? '天后' : '天已过') + '</span>';
      return '<div class="list-item ev-item is-' + kind + '" data-id="' + e.id + '" data-index="' + v.index + '">' +
        '<div class="ev-main">' +
          '<div class="ev-title">' + U.esc(e.title) + '</div>' +
          '<div class="ev-sub">' + U.esc(e.date) + ' ' + U.weekday(e.date) +
            ' · <span class="tag-' + kind + '">' + (isFuture ? '倒数日' : (isToday ? '今天' : '正数日')) + '</span>' +
            (e.note ? ' · ' + U.esc(e.note) : '') + '</div>' +
        '</div>' +
        '<div class="ev-num is-' + kind + '">' + numHtml + '</div>' +
        '<div class="ev-actions">' +
          '<button class="mini-btn" data-act="up" title="上移">↑</button>' +
          '<button class="mini-btn" data-act="down" title="下移">↓</button>' +
          '<button class="mini-btn" data-act="edit" title="编辑">✎</button>' +
          '<button class="mini-btn" data-act="del" title="删除">✕</button>' +
        '</div>' +
        '<button class="drag-handle" data-act="drag" title="拖动排序">⠿</button>' +
      '</div>';
    }).join('');

    listEl.innerHTML = html;

    listEl.querySelectorAll('.ev-item').forEach(function (node) {
      var id = node.getAttribute('data-id');
      var index = +node.getAttribute('data-index');
      node.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'up') move(index, index - 1);
          else if (act === 'down') move(index, index + 1);
          else if (act === 'edit') openForm(id);
          else if (act === 'del') remove(id);
        });
      });
    });
  }

  function move(from, to) {
    var len = store.events.all().length;
    if (to < 0 || to >= len) return;
    store.events.reorder(from, to);
    render();
  }

  function remove(id) {
    var e = store.events.byId(id);
    if (!e) return;
    ui.confirm({ title: '删除', message: '确定删除「' + e.title + '」吗？', danger: true, okText: '删除' })
      .then(function (ok) {
        if (!ok) return;
        store.events.remove(id);
        render();
        ui.toast('已删除');
      });
  }

  function openForm(id) {
    var e = id ? store.events.byId(id) : null;
    var body =
      '<div class="field"><label>名称</label><input class="input" id="evTitle" placeholder="例如 项目上线 / 结婚纪念日" value="' + U.esc(e ? e.title : '') + '" /></div>' +
      '<div class="field"><label>目标日期</label><input class="input" type="date" id="evDate" value="' + U.esc(e ? e.date : U.todayStr()) + '" /></div>' +
      '<div class="field"><label>备注（可选）</label><input class="input" id="evNote" placeholder="补充说明" value="' + U.esc(e ? e.note : '') + '" /></div>' +
      '<p class="hint" style="margin:0">日期在未来显示为倒数日（蓝色），在过去显示为正数日（紫色）。</p>';

    ui.modal({
      title: e ? '编辑' : '添加日子',
      body: body,
      okText: '保存',
      onOk: function (close) {
        var title = document.getElementById('evTitle').value.trim();
        var date = document.getElementById('evDate').value;
        var note = document.getElementById('evNote').value.trim();
        if (!title) { ui.toast('请填写名称', 'error'); return false; }
        if (!U.isValidDate(date)) { ui.toast('请选择有效日期', 'error'); return false; }
        if (e) store.events.update(id, { title: title, date: date, note: note });
        else store.events.add({ title: title, date: date, note: note });
        render();
        ui.toast('已保存', 'ok');
      }
    });
  }

  /* ---------- 拖拽排序（指针事件，兼容触屏与鼠标） ---------- */
  function bindDrag() {
    listEl.addEventListener('pointerdown', function (ev) {
      var handle = ev.target.closest ? ev.target.closest('.drag-handle') : null;
      if (!handle) return;
      var item = handle.closest('.ev-item');
      if (!item) return;
      var items = Array.prototype.slice.call(listEl.querySelectorAll('.ev-item'));
      var from = items.indexOf(item);
      if (from < 0) return;

      ev.preventDefault();
      var rects = items.map(function (el) { return el.getBoundingClientRect(); });
      var startY = ev.clientY;
      var step = rects[from].height + GAP;
      var target = from;

      item.classList.add('is-dragging');
      items.forEach(function (el, i) { if (i !== from) el.classList.add('is-sliding'); });

      function onMove(e) {
        var dy = e.clientY - startY;
        item.style.transform = 'translateY(' + dy + 'px)';
        var center = rects[from].top + dy + rects[from].height / 2;
        var t = from, i, mid;
        if (dy < 0) {
          for (i = from - 1; i >= 0; i--) {
            mid = rects[i].top + rects[i].height / 2;
            if (center < mid) t = i; else break;
          }
        } else {
          for (i = from + 1; i < items.length; i++) {
            mid = rects[i].top + rects[i].height / 2;
            if (center > mid) t = i; else break;
          }
        }
        if (t !== target) { target = t; applyShifts(); }
      }

      function applyShifts() {
        items.forEach(function (el, i) {
          if (i === from) return;
          var shift = 0;
          if (from < target && i > from && i <= target) shift = -step;
          else if (from > target && i >= target && i < from) shift = step;
          el.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
      }

      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        items.forEach(function (el) {
          el.classList.remove('is-dragging', 'is-sliding');
          el.style.transform = '';
        });
        if (target !== from) {
          // 视图索引 -> 真实数据索引
          var realFrom = +items[from].getAttribute('data-index');
          var realTo = +items[target].getAttribute('data-index');
          store.events.reorder(realFrom, realTo);
          render();
        }
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  }

  App.events = { init: init, render: render };
})(window.App);
