window.App = window.App || {};

(function (App) {
  'use strict';

  var PAD_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }

  var U = {
    pad: pad,

    dateToStr: function (d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },

    todayStr: function () { return U.dateToStr(new Date()); },

    parseDate: function (s) {
      var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
      if (!m) return null;
      var d = new Date(+m[1], +m[2] - 1, +m[3]);
      return isNaN(d.getTime()) ? null : d;
    },

    isValidDate: function (s) { return !!U.parseDate(s); },

    /** 把 2026-1-9 之类的写法统一成 2026-01-09 */
    normalizeDateStr: function (s) {
      var d = U.parseDate(s);
      return d ? U.dateToStr(d) : String(s || '').trim();
    },

    /** 日期字符串加/减天数 */
    addDays: function (s, n) {
      var d = U.parseDate(s) || new Date();
      d.setDate(d.getDate() + n);
      return U.dateToStr(d);
    },

    /** 日期字符串加月份（按日历月，处理月末） */
    addMonths: function (s, n) {
      var d = U.parseDate(s) || new Date();
      var day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return U.dateToStr(d);
    },

    /** to - from，单位天（正表示 to 在 from 之后） */
    diffDays: function (from, to) {
      var a = U.parseDate(from), b = U.parseDate(to);
      if (!a || !b) return null;
      a.setHours(0, 0, 0, 0);
      b.setHours(0, 0, 0, 0);
      return Math.round((b - a) / 86400000);
    },

    weekday: function (s) {
      var d = U.parseDate(s);
      return d ? WEEK[d.getDay()] : '';
    },

    fmtDateCN: function (s) {
      var d = U.parseDate(s);
      if (!d) return s || '';
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
    },

    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return PAD_MAP[c]; });
    },

    num: function (n) {
      var v = Math.round(Number(n) || 0);
      return v.toLocaleString('zh-CN');
    },

    /** 归属季度 {year, q} */
    quarterOf: function (dateStr) {
      var s = U.isValidDate(dateStr) ? dateStr : U.todayStr();
      var y = +s.slice(0, 4), m = +s.slice(5, 7);
      return { year: y, q: Math.floor((m - 1) / 3) + 1 };
    },

    /** 季度起止日期 {start, end} */
    quarterRange: function (year, q) {
      var startMonth = (q - 1) * 3 + 1;
      var endMonth = q * 3;
      var lastDay = new Date(year, endMonth, 0).getDate();
      return {
        start: year + '-' + pad(startMonth) + '-01',
        end: year + '-' + pad(endMonth) + '-' + pad(lastDay)
      };
    },

    /** 判断日期字符串是否在闭区间内 */
    inRange: function (s, start, end) { return s >= start && s <= end; },

    download: function (filename, content, mime) {
      try {
        var blob = new Blob([content], { type: (mime || 'application/json') + ';charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
        return true;
      } catch (e) {
        return false;
      }
    },

    /** 选择并读取文本文件，返回 {name, text} 或 null */
    pickFile: function (accept) {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || '.json,.csv,.txt';
        input.style.display = 'none';
        document.body.appendChild(input);
        var done = function (val) {
          input.remove();
          resolve(val);
        };
        input.addEventListener('change', function () {
          var f = input.files && input.files[0];
          if (!f) return done(null);
          var reader = new FileReader();
          reader.onload = function () { done({ name: f.name, text: String(reader.result) }); };
          reader.onerror = function () { done(null); };
          reader.readAsText(f, 'utf-8');
        });
        input.click();
      });
    },

    csvCell: function (v) {
      var s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    },

    /** 将二维数组转为 CSV 文本（含 BOM，便于 Excel 打开） */
    toCSV: function (rows) {
      return '\ufeff' + rows.map(function (r) {
        return r.map(U.csvCell).join(',');
      }).join('\r\n');
    },

    /** 解析 CSV 文本为二维数组，支持引号包裹与换行 */
    parseCSV: function (text) {
      var rows = [];
      var row = [];
      var cell = '';
      var inQuote = false;
      var str = String(text || '').replace(/^\ufeff/, '');
      for (var i = 0; i < str.length; i++) {
        var c = str[i];
        if (inQuote) {
          if (c === '"') {
            if (str[i + 1] === '"') { cell += '"'; i++; }
            else inQuote = false;
          } else cell += c;
        } else if (c === '"') {
          inQuote = true;
        } else if (c === ',') {
          row.push(cell); cell = '';
        } else if (c === '\n') {
          row.push(cell); rows.push(row); row = []; cell = '';
        } else if (c !== '\r') {
          cell += c;
        }
      }
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
      return rows.filter(function (r) {
        return r.some(function (v) { return String(v).trim() !== ''; });
      });
    },

    /** 数组重排：把 from 位置元素移动到 to 位置 */
    move: function (arr, from, to) {
      if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
      var item = arr.splice(from, 1)[0];
      arr.splice(to, 0, item);
      return arr;
    },

    debounce: function (fn, wait) {
      var timer = null;
      return function () {
        var args = arguments, self = this;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(self, args); }, wait || 300);
      };
    }
  };

  App.utils = U;
})(window.App);
