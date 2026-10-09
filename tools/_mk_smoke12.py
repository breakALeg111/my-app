# -*- coding: utf-8 -*-
"""生成临时冒烟页面：验证导入修复 + 日期单行显示"""
import io

html = io.open('index.html', encoding='utf-8').read()

fixture = '''
<script>
window.__err = '';
window.addEventListener('error', function (e) { window.__err += '[' + (e.message || '') + ']'; }, true);
localStorage.setItem('dailyhub.data.v1', JSON.stringify({
  version: 1,
  diary: { '2026-10-09': { content: '今天的日志', updatedAt: 1 }, '2026-09-03': { content: '九月三日', updatedAt: 2 } },
  events: [], maintenance: { mileage: 0, mileageUpdatedAt: '', items: [] },
  settings: { tab: 'diary' }
}));
</script>
'''

test = '''
<script>
var out = [];
function check(name, actual, expected) {
  var ok = String(actual) === String(expected);
  out.push((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' => ' + JSON.stringify(String(actual)) + ' 期望 ' + JSON.stringify(String(expected))));
}
function done() {
  var pre = document.createElement('pre');
  pre.id = 'result';
  pre.textContent = out.join('\\n') + '\\nERR=' + window.__err;
  document.body.appendChild(pre);
}

setTimeout(function () {
  // 1. 日期显示：单行
  var bar = document.querySelector('.datebar');
  var disp = document.querySelector('.date-display');
  var big = document.querySelector('.date-big');
  var week = document.getElementById('diaryWeek');
  out.push('INFO barH=' + Math.round(bar.getBoundingClientRect().height) +
           ' dispH=' + Math.round(disp.getBoundingClientRect().height) +
           ' bigH=' + Math.round(big.getBoundingClientRect().height) +
           ' bigW=' + Math.round(big.getBoundingClientRect().width) +
           ' weekW=' + Math.round(week.getBoundingClientRect().width));
  check('date.bigOneLine', big.getBoundingClientRect().height <= 26, true);
  check('date.barOneRow', bar.getBoundingClientRect().height <= 72, true);
  check('date.bigText', big.textContent, '10月9日');
  check('date.weekText', week.textContent.indexOf('今天') >= 0 && week.textContent.indexOf('2026 年') >= 0, true);
  check('date.fontSize', getComputedStyle(document.querySelector('.date-big b')).fontSize, '16px');
  check('date.weekNoWrap', getComputedStyle(week).whiteSpace, 'nowrap');

  // 2. 导出
  document.getElementById('exportAllText').click();
  check('export.modal', !!document.getElementById('expText'), true);
  var closeBtn = document.querySelector('#modalHost .modal-foot .btn-primary');
  if (closeBtn) closeBtn.click();

  // 3. 导入（修复点）
  setTimeout(function () {
    document.getElementById('importText').click();
    document.getElementById('impText').value =
      '工作日志导出 - 全部记录\\n共 2 条记录\\n==================================================\\n\\n' +
      '【2026-05-01】\\n五月的新日志\\n------------------------------\\n' +
      '【2026-10-09】\\n覆盖后的今天\\n------------------------------';
    document.querySelector('#modalHost .modal-foot .btn-primary').click();
    setTimeout(function () {
      var choiceBtns = document.querySelectorAll('#modalHost [data-choice]');
      check('import.choiceVisible', choiceBtns.length >= 1, true);
      if (!choiceBtns.length) { done(); return; }
      choiceBtns[0].click();   // 合并
      setTimeout(function () {
        check('import.count', App.store.diary.count(), 3);
        check('import.new', App.store.diary.get('2026-05-01'), '五月的新日志');
        check('import.overwrite', App.store.diary.get('2026-10-09'), '覆盖后的今天');

        // 4. 仅补充缺失模式
        document.getElementById('importText').click();
        document.getElementById('impText').value = '【2026-06-06】\\n六月日志\\n------------------------------\\n【2026-10-09】\\n不该覆盖\\n------------------------------';
        document.querySelector('#modalHost .modal-foot .btn-primary').click();
        setTimeout(function () {
          var btns = document.querySelectorAll('#modalHost [data-choice]');
          btns[1].click();  // 仅补充缺失
          setTimeout(function () {
            check('append.count', App.store.diary.count(), 4);
            check('append.keep', App.store.diary.get('2026-10-09'), '覆盖后的今天');
            check('append.new', App.store.diary.get('2026-06-06'), '六月日志');
            check('noJsError', window.__err, '');
            done();
          }, 400);
        }, 200);
      }, 400);
    }, 250);
  }, 250);
}, 2600);
</script>
'''

html = html.replace('<body>', '<body>' + fixture, 1)
html = html.replace('</body>', test + '</body>', 1)
io.open('_smoke12.html', 'w', encoding='utf-8').write(html)
print('ok')
