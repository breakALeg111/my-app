(function (App) {
  'use strict';

  var U = App.utils, store = App.store, ui = App.ui;

  var SEP_EQ = '==================================================';   // 头部下方长横线
  var SEP_DASH = '------------------------------';                   // 每条记录的分隔线

  function init() {
    document.getElementById('exportQuarterText').addEventListener('click', function () { exportText('quarter'); });
    document.getElementById('exportAllText').addEventListener('click', function () { exportText('all'); });
    document.getElementById('importText').addEventListener('click', importText);

    initQuarterSelect();
  }

  function initQuarterSelect() {
    var yearSel = document.getElementById('qYear');
    var now = new Date().getFullYear();
    var years = [];
    Object.keys(store.state.diary).forEach(function (d) {
      var y = +d.slice(0, 4);
      if (years.indexOf(y) < 0) years.push(y);
    });
    for (var i = now; i >= now - 5; i--) if (years.indexOf(i) < 0) years.push(i);
    years.sort(function (a, b) { return b - a; });
    yearSel.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + ' 年</option>'; }).join('');

    var q = U.quarterOf(U.todayStr());
    yearSel.value = String(q.year);
    document.getElementById('qQuarter').value = String(q.q);
  }

  /* ---------------- 导出：纯文本 + 复制 ---------------- */

  function nowText() {
    var d = new Date();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':' + U.pad(d.getSeconds());
  }

  function entriesOf(scope) {
    var dates = Object.keys(store.state.diary).sort().reverse();
    if (scope === 'quarter') {
      var year = +document.getElementById('qYear').value;
      var q = +document.getElementById('qQuarter').value;
      var range = U.quarterRange(year, q);
      dates = dates.filter(function (d) { return U.inRange(d, range.start, range.end); });
      return { title: '工作日志导出 - ' + year + '年第' + q + '季度', dates: dates };
    }
    return { title: '工作日志导出 - 全部记录', dates: dates };
  }

  function buildText(title, dates) {
    var lines = [];
    lines.push(title);
    lines.push('导出时间: ' + nowText());
    lines.push('共 ' + dates.length + ' 条记录');
    lines.push(SEP_EQ);
    lines.push('');
    dates.forEach(function (d) {
      lines.push('【' + d + '】');
      lines.push(store.diary.get(d));
      lines.push(SEP_DASH);
      lines.push('');
    });
    return lines.join('\n');
  }

  function exportText(scope) {
    var info = entriesOf(scope);
    if (!info.dates.length) {
      ui.toast(scope === 'quarter' ? '该季度没有日志' : '还没有任何日志', 'error');
      return;
    }
    var text = buildText(info.title, info.dates);

    ui.modal({
      title: '日志文本（' + info.dates.length + ' 条）',
      body: '<textarea class="textarea" id="expText" readonly rows="12">' + U.esc(text) + '</textarea>' +
        '<div class="btn-row"><button type="button" class="btn btn-soft btn-sm" id="expCopy">复制全部文本</button>' +
        '<span class="hint">也可以长按选中后手工复制</span></div>',
      okText: '关闭',
      hideCancel: true,
      noFocus: true,
      onOk: function () { }
    });

    document.getElementById('expCopy').addEventListener('click', function () {
      ui.copyText(document.getElementById('expText').value);
    });
  }

  /* ---------------- 导入：粘贴文本 ---------------- */

  var DATE_RE = /^【\s*(\d{4})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})\s*日?\s*】/;

  function isSeparator(line) {
    var t = line.trim();
    return t.length >= 6 && /^[=＝\-—–_]+$/.test(t);
  }

  /** 解析导出文本，返回 [{date, content}] */
  function parseLogText(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var cur = null;

    function push() {
      if (!cur) return;
      var content = cur.lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
      if (content) out.push({ date: cur.date, content: content });
      cur = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = DATE_RE.exec(line.trim());
      if (m) {
        push();
        cur = {
          date: m[1] + '-' + U.pad(+m[2]) + '-' + U.pad(+m[3]),
          lines: []
        };
        var rest = line.trim().slice(m[0].length);
        if (rest) cur.lines.push(rest.replace(/^[：:]\s*/, ''));
        continue;
      }
      if (isSeparator(line)) { push(); continue; }
      if (cur) cur.lines.push(line);
    }
    push();

    return out.filter(function (e) { return U.isValidDate(e.date); });
  }

  function importText() {
    ui.modal({
      title: '粘贴日志文本',
      body: '<textarea class="textarea" id="impText" rows="12" placeholder="粘贴形如：&#10;【2026-09-03】&#10;上线交割智慧监管平台仿真环境&#10;------------------------------"></textarea>' +
        '<p class="hint" style="margin:0">每行一个记录块，日期写在【】里，内容直到分隔线为止。</p>',
      okText: '开始导入',
      cancelText: '取消',
      onOk: function (close) {
        var text = document.getElementById('impText').value;
        var rows = parseLogText(text);
        if (!rows.length) { ui.toast('没有解析到日志记录，请检查格式', 'error'); return false; }

        setTimeout(function () {
          close();
          ui.choice({
            title: '导入 ' + rows.length + ' 条日志',
            message: '日期范围：' + rows[rows.length - 1].date + ' ~ ' + rows[0].date + '。选择导入方式：',
            options: [
              { text: '合并（同日期以导入内容为准）', value: 'merge', primary: true },
              { text: '仅补充缺失的日期', value: 'append' }
            ]
          }).then(function (mode) {
            if (!mode) return;
            var added = 0, updated = 0, skipped = 0;
            rows.forEach(function (r) {
              var has = !!store.state.diary[r.date];
              if (has && mode === 'append') { skipped++; return; }
              if (has) updated++; else added++;
              store.state.diary[r.date] = { content: r.content, updatedAt: Date.now() };
            });
            store.save();
            App.refreshAll();
            ui.toast('导入完成：新增 ' + added + ' 条，更新 ' + updated + ' 条' + (skipped ? '，跳过 ' + skipped + ' 条' : ''), 'ok');
          });
        }, 0);
        return false;
      }
    });
  }

  App.dataio = { init: init, parseLogText: parseLogText, buildText: buildText };
})(window.App);
