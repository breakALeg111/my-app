(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui;
  var listEl, mileInput, mileMeta, sortSelect;
  var LABEL = { safe: '安全', warn: '临近', over: '超期' };

  function init() {
    listEl = document.getElementById('careList');
    mileInput = document.getElementById('mileInput');
    mileMeta = document.getElementById('mileMeta');
    sortSelect = document.getElementById('careSort');

    sortSelect.value = store.state.settings.careSort || 'urgent';
    mileInput.value = store.care.mileage() || '';

    document.getElementById('mileSave').addEventListener('click', function () {
      var v = Number(mileInput.value);
      if (!mileInput.value.trim() || isNaN(v) || v < 0) { ui.toast('请输入有效里程', 'error'); return; }
      store.care.setMileage(v);
      renderMileage();
      renderList();
      ui.toast('里程已更新', 'ok');
    });

    sortSelect.addEventListener('change', function () {
      store.state.settings.careSort = sortSelect.value;
      store.save();
      renderList();
    });

    document.getElementById('addItem').addEventListener('click', function () { openForm(null); });

    renderMileage();
    renderList();
  }

  function renderMileage() {
    var km = store.care.mileage();
    var at = store.care.mileageUpdatedAt();
    mileInput.value = km || '';
    mileMeta.textContent = km ? ('更新于 ' + at) : '尚未录入';
  }

  function renderList() {
    var items = store.care.items().slice();
    if (!items.length) {
      listEl.innerHTML = '<div class="empty">还没有保养项目，点「+ 添加」录入第一条</div>';
      return;
    }

    var computed = items.map(function (it) { return { item: it, s: store.care.status(it) }; });
    var mode = sortSelect.value;

    computed.sort(function (a, b) {
      if (mode === 'name') return a.item.name.localeCompare(b.item.name, 'zh-CN');
      if (mode === 'created') return (a.item.createdAt || 0) - (b.item.createdAt || 0);
      var rank = { over: 0, warn: 1, safe: 2 };
      if (rank[a.s.status] !== rank[b.s.status]) return rank[a.s.status] - rank[b.s.status];
      var ra = Math.min(a.s.remainKm == null ? Infinity : a.s.remainKm, a.s.remainDays == null ? Infinity : a.s.remainDays * 30);
      var rb = Math.min(b.s.remainKm == null ? Infinity : b.s.remainKm, b.s.remainDays == null ? Infinity : b.s.remainDays * 30);
      return ra - rb;
    });

    var html = computed.map(function (c) {
      var it = c.item, s = c.s;
      var cls = s.status === 'safe' ? '' : ' s-' + s.status;
      var kmText = s.remainKm == null ? '未设置' : (s.remainKm <= 0 ? '超 ' + U.num(-s.remainKm) : U.num(s.remainKm));
      var dayText = s.remainDays == null ? '未设置' : (s.remainDays <= 0 ? '超 ' + Math.abs(s.remainDays) : s.remainDays);
      var unitKm = s.remainKm == null ? '' : ' km';
      var unitDay = s.remainDays == null ? '' : ' 天';

      var nextParts = [];
      if (it.intervalKm > 0) nextParts.push(U.num(s.nextKm) + ' km');
      if (it.intervalValue > 0) nextParts.push(s.nextDate);
      var nextText = nextParts.length ? nextParts.join(' 或 ') + '（先到为准）' : '未设置周期';

      var period = [];
      if (it.intervalKm > 0) period.push(U.num(it.intervalKm) + ' km');
      if (it.intervalValue > 0) period.push(it.intervalValue + (it.intervalUnit === 'day' ? ' 天' : ' 个月'));

      return '<div class="list-item care-item' + cls + '" data-id="' + it.id + '">' +
        '<div class="care-top">' +
          '<div class="care-name">' + U.esc(it.name) + '</div>' +
          '<span class="care-tag' + cls + '">' + LABEL[s.status] + '</span>' +
        '</div>' +
        '<div class="care-metrics">' +
          '<div class="metric">剩余里程<b class="' + (s.remainKm == null ? '' : cls) + '">' + kmText + unitKm + '</b></div>' +
          '<div class="metric">剩余天数<b class="' + (s.remainDays == null ? '' : cls) + '">' + dayText + unitDay + '</b></div>' +
          '<div class="metric">保养周期<b style="font-size:13px">' + U.esc(period.join(' / ') || '—') + '</b></div>' +
        '</div>' +
        '<div class="bar"><i class="' + cls + '" style="width:' + Math.round(s.percent * 100) + '%"></i></div>' +
        '<div class="care-foot">' +
          '<span class="care-next">下次保养：' + U.esc(nextText) + '</span>' +
          '<div class="btn-row">' +
            '<button class="btn btn-ghost btn-sm" data-act="edit">编辑</button>' +
            '<button class="btn btn-ghost btn-sm" data-act="del">删除</button>' +
            '<button class="btn btn-primary btn-sm" data-act="done">已保养</button>' +
          '</div>' +
        '</div>' +
        (it.note ? '<div class="care-next" style="margin-top:6px">备注：' + U.esc(it.note) + '</div>' : '') +
      '</div>';
    }).join('');

    listEl.innerHTML = html;

    listEl.querySelectorAll('.care-item').forEach(function (node) {
      var id = node.getAttribute('data-id');
      node.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'edit') openForm(id);
          else if (act === 'del') remove(id);
          else if (act === 'done') markDone(id);
        });
      });
    });
  }

  function markDone(id) {
    var it = store.care.byId(id);
    if (!it) return;
    ui.confirm({
      title: '记录保养',
      message: '将「' + it.name + '」的上次保养里程更新为当前 ' + U.num(store.care.mileage()) + ' km，日期更新为今天？',
      okText: '已完成'
    }).then(function (ok) {
      if (!ok) return;
      store.care.done(id);
      renderList();
      ui.toast('已记录，周期重新开始计算', 'ok');
    });
  }

  function remove(id) {
    var it = store.care.byId(id);
    if (!it) return;
    ui.confirm({ title: '删除项目', message: '确定删除「' + it.name + '」吗？', danger: true, okText: '删除' })
      .then(function (ok) {
        if (!ok) return;
        store.care.remove(id);
        renderList();
        ui.toast('已删除');
      });
  }

  function openForm(id) {
    var it = id ? store.care.byId(id) : null;
    var d = it || {
      name: '',
      intervalKm: '',
      intervalValue: '',
      intervalUnit: 'month',
      lastKm: store.care.mileage(),
      lastDate: U.todayStr(),
      note: ''
    };

    var body =
      '<div class="field"><label>项目名称</label><input class="input" id="cName" placeholder="例如 机油机滤" value="' + U.esc(d.name) + '" /></div>' +
      '<div class="field-2">' +
        '<div class="field"><label>保养周期 · 公里</label><input class="input" type="number" min="0" inputmode="numeric" id="cKm" placeholder="5000" value="' + U.esc(d.intervalKm) + '" /></div>' +
        '<div class="field"><label>保养周期 · 时间</label><div style="display:flex;gap:6px">' +
          '<input class="input" type="number" min="0" inputmode="numeric" id="cVal" placeholder="6" value="' + U.esc(d.intervalValue) + '" style="flex:1;min-width:0" />' +
          '<select class="input input-sm" id="cUnit"><option value="month"' + (d.intervalUnit === 'month' ? ' selected' : '') + '>个月</option><option value="day"' + (d.intervalUnit === 'day' ? ' selected' : '') + '>天</option></select>' +
        '</div></div>' +
      '</div>' +
      '<div class="field-2">' +
        '<div class="field"><label>上次保养里程 (km)</label><input class="input" type="number" min="0" inputmode="numeric" id="cLastKm" value="' + U.esc(d.lastKm) + '" /></div>' +
        '<div class="field"><label>上次保养日期</label><input class="input" type="date" id="cLastDate" value="' + U.esc(d.lastDate) + '" /></div>' +
      '</div>' +
      '<div class="field"><label>备注（可选）</label><input class="input" id="cNote" placeholder="例如 使用全合成机油" value="' + U.esc(d.note) + '" /></div>' +
      '<p class="hint" style="margin:0">公里与时间两者以先到为准；留空表示不启用该项周期。</p>';

    ui.modal({
      title: it ? '编辑保养项目' : '添加保养项目',
      body: body,
      okText: '保存',
      onOk: function () {
        var name = document.getElementById('cName').value.trim();
        if (!name) { ui.toast('请填写项目名称', 'error'); return false; }
        var lastDate = document.getElementById('cLastDate').value;
        if (!U.isValidDate(lastDate)) { ui.toast('请选择上次保养日期', 'error'); return false; }
        var data = {
          name: name,
          intervalKm: document.getElementById('cKm').value,
          intervalValue: document.getElementById('cVal').value,
          intervalUnit: document.getElementById('cUnit').value,
          lastKm: document.getElementById('cLastKm').value,
          lastDate: lastDate,
          note: document.getElementById('cNote').value.trim()
        };
        if (it) store.care.update(id, data);
        else store.care.add(data);
        renderList();
        ui.toast('已保存', 'ok');
      }
    });
  }

  App.care = { init: init, render: renderList, renderMileage: renderMileage };
})(window.App);
