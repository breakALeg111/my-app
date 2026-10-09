# -*- coding: utf-8 -*-
"""生成临时冒烟页面：复现导入/导出流程"""
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
  // ---- 导出 ----
  document.getElementById('exportAllText').click();
  check('export.modal', !!document.getElementById('expText'), true);
  check('export.copyBtn', !!document.getElementById('expCopy'), true);
  if (document.getElementById('expText')) {
    check('export.head', document.getElementById('expText').value.split('\\n')[0], '工作日志导出 - 全部记录');
  }
  var closeBtn = document.querySelector('#modalHost .modal-foot .btn-primary');
  check('export.closeBtn', !!closeBtn, true);
  if (closeBtn) closeBtn.click();
  check('export.closed', document.getElementById('modalHost').classList.contains('is-open'), false);

  // ---- 导入 ----
  setTimeout(function () {
    document.getElementById('importText').click();
    check('import.modal', !!document.getElementById('impText'), true);
    var ta = document.getElementById('impText');
    ta.value = '工作日志导出 - 全部记录\\n共 2 条记录\\n==================================================\\n\\n【2026-05-01】\\n五月的新日志\\n------------------------------\\n【2026-10-09】\\n覆盖后的今天\\n------------------------------';
    var okBtn = document.querySelector('#modalHost .modal-foot .btn-primary');
    okBtn.click();

    setTimeout(function () {
      // 选择弹层是否还在（是否被 popstate 误关）
      var choiceBtns = document.querySelectorAll('#modalHost [data-choice]');
      check('import.choiceVisible', choiceBtns.length >= 1, true);
      out.push('INFO choiceCount=' + choiceBtns.length);
      if (choiceBtns.length) {
        choiceBtns[0].click();  // 合并
        setTimeout(function () {
          check('import.diaryCount', App.store.diary.count(), 3);
          check('import.newEntry', App.store.diary.get('2026-05-01'), '五月的新日志');
          check('import.overwrite', App.store.diary.get('2026-10-09'), '覆盖后的今天');
          done();
        }, 400);
      } else {
        done();
      }
    }, 300);
  }, 300);
}, 2600);
</script>
'''

html = html.replace('<body>', '<body>' + fixture, 1)
html = html.replace('</body>', test + '</body>', 1)
io.open('_smoke11.html', 'w', encoding='utf-8').write(html)
print('ok')
