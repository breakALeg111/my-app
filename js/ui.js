(function (App) {
  'use strict';

  var U = App.utils;
  var toastHost, modalHost;
  var modalStack = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function toast(msg, type) {
    if (!toastHost) toastHost = document.getElementById('toastHost');
    if (!toastHost) return;
    var t = el('div', 'toast' + (type ? ' is-' + type : ''), U.esc(msg));
    toastHost.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, type === 'error' ? 3200 : 2000);
  }

  function closeModal() {
    if (!modalHost) return;
    modalHost.classList.remove('is-open');
    modalHost.innerHTML = '';
    modalStack = 0;
    document.body.style.overflow = '';
  }

  /**
   * 底部弹层表单
   * @param {Object} opts {title, body, okText, cancelText, onOk(close, modalEl)}
   */
  function modal(opts) {
    opts = opts || {};
    if (!modalHost) modalHost = document.getElementById('modalHost');
    if (!modalHost) return;
    modalHost.innerHTML = '';

    var mask = el('div', 'modal-mask');
    mask.addEventListener('click', closeModal);

    var box = el('div', 'modal');
    box.appendChild(el('h3', 'modal-title', U.esc(opts.title || '')));
    var body = el('div', 'modal-body', opts.body || '');
    box.appendChild(body);

    var foot = el('div', 'modal-foot');
    var cancel = el('button', 'btn btn-ghost', U.esc(opts.cancelText || '取消'));
    cancel.type = 'button';
    cancel.addEventListener('click', closeModal);
    if (!opts.hideCancel) foot.appendChild(cancel);
    var ok = el('button', 'btn ' + (opts.okClass || 'btn-primary'), U.esc(opts.okText || '确定'));
    ok.type = 'button';
    ok.addEventListener('click', function () {
      if (typeof opts.onOk === 'function') {
        if (opts.onOk(closeModal, box) !== false) closeModal();
      } else {
        closeModal();
      }
    });
    foot.appendChild(cancel);
    foot.appendChild(ok);
    box.appendChild(foot);

    modalHost.appendChild(mask);
    modalHost.appendChild(box);
    modalHost.classList.add('is-open');
    modalStack++;
    document.body.style.overflow = 'hidden';

    var first = box.querySelector('input, textarea, select');
    if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 120);
    return box;
  }

  /** 确认框，返回 Promise<boolean> */
  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      modal({
        title: opts.title || '确认',
        body: '<p style="margin:0">' + U.esc(opts.message || '') + '</p>',
        okText: opts.okText || '确定',
        cancelText: opts.cancelText || '取消',
        okClass: opts.danger ? 'btn-danger' : 'btn-primary',
        noFocus: true,
        onOk: function (close) { resolve(true); },
        onCancel: function () { resolve(false); }
      });
      // 取消按钮点击时也要 resolve(false)
      var mask = modalHost.querySelector('.modal-mask');
      if (mask) mask.addEventListener('click', function () { resolve(false); }, { once: true });
      var cancelBtn = modalHost.querySelector('.modal-foot .btn-ghost');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { resolve(false); }, { once: true });
    });
  }

  /** 多选项对话框，返回 Promise<value|null> */
  function choice(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var btns = (opts.options || []).map(function (o, i) {
        return '<button type="button" class="btn ' + (o.primary ? 'btn-primary' : 'btn-soft') + '" data-choice="' + i + '">' + U.esc(o.text) + '</button>';
      }).join('');
      modal({
        title: opts.title || '请选择',
        body: '<p style="margin:0 0 4px">' + U.esc(opts.message || '') + '</p><div class="btn-grid" style="grid-template-columns:1fr">' + btns + '</div>',
        okText: '取消',
        cancelText: '取消',
        noFocus: true,
        onOk: function () { resolve(null); }
      });
      modalHost.querySelectorAll('[data-choice]').forEach(function (b) {
        b.addEventListener('click', function () {
          resolve((opts.options || [])[+b.getAttribute('data-choice')].value);
          closeModal();
        });
      });
    });
  }

  /** 复制文本到剪贴板，失败时提示手工复制 */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        toast('已复制到剪贴板', 'ok');
        return true;
      }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? '已复制到剪贴板' : '复制失败，请长按文本手工复制', ok ? 'ok' : 'error');
      return ok;
    } catch (e) {
      toast('复制失败，请长按文本手工复制', 'error');
      return false;
    }
  }

  App.ui = {
    el: el,
    toast: toast,
    copyText: copyText,
    modal: modal,
    closeModal: closeModal,
    confirm: confirm,
    choice: choice,
    isModalOpen: function () { return modalStack > 0; }
  };
})(window.App);
