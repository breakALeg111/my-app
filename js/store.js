(function (App) {
  'use strict';

  var WARN_KM = 1000;    // 临近保养里程阈值
  var WARN_DAYS = 30;    // 临近保养天数阈值
  var U = App.utils;

  var state = defaults();
  var writeTimer = null;
  var dirty = false;

  function defaults() {
    return {
      version: 1,
      diary: {},                                   // { 'YYYY-MM-DD': { content, updatedAt } }
      events: [],                                  // [{ id, title, date, note, createdAt }]
      maintenance: { mileage: 0, mileageUpdatedAt: '', items: [] },
      settings: {
        tab: 'diary',
        careSort: 'urgent',
        eventsFilter: 'all',
        lastBackupAt: 0,
        cos: { provider: 'cos', ak: '', sk: '', bucket: '', region: '', key: 'daily-hub/backup.json', auto: false }
      }
    };
  }

  function normalize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return d;

    d.diary = (raw.diary && typeof raw.diary === 'object') ? raw.diary : {};
    Object.keys(d.diary).forEach(function (k) {
      var v = d.diary[k];
      if (typeof v === 'string') d.diary[k] = { content: v, updatedAt: 0 };
      else if (!v || typeof v !== 'object') delete d.diary[k];
    });

    d.events = Array.isArray(raw.events) ? raw.events.filter(function (e) {
      return e && typeof e === 'object' && U.isValidDate(e.date);
    }).map(function (e) {
      return {
        id: e.id || U.uid(),
        title: String(e.title || '未命名'),
        date: e.date,
        note: e.note ? String(e.note) : '',
        createdAt: e.createdAt || 0
      };
    }) : [];

    var m = raw.maintenance || {};
    d.maintenance.mileage = Number(m.mileage) || 0;
    d.maintenance.mileageUpdatedAt = U.isValidDate(m.mileageUpdatedAt) ? m.mileageUpdatedAt : '';
    d.maintenance.items = Array.isArray(m.items) ? m.items.filter(function (i) {
      return i && typeof i === 'object';
    }).map(function (i) {
      return {
        id: i.id || U.uid(),
        name: String(i.name || '未命名项目'),
        intervalKm: Number(i.intervalKm) || 0,
        intervalValue: Number(i.intervalValue) || 0,
        intervalUnit: i.intervalUnit === 'day' ? 'day' : 'month',
        lastKm: Number(i.lastKm) || 0,
        lastDate: U.isValidDate(i.lastDate) ? i.lastDate : U.todayStr(),
        note: i.note ? String(i.note) : '',
        createdAt: i.createdAt || 0
      };
    }) : [];

    var s = raw.settings || {};
    d.settings.tab = ['diary', 'events', 'care', 'settings'].indexOf(s.tab) >= 0 ? s.tab : 'diary';
    d.settings.careSort = ['urgent', 'name', 'created'].indexOf(s.careSort) >= 0 ? s.careSort : 'urgent';
    d.settings.eventsFilter = ['all', 'future', 'past'].indexOf(s.eventsFilter) >= 0 ? s.eventsFilter : 'all';
    d.settings.lastBackupAt = Number(s.lastBackupAt) || 0;

    var o = s.cos || {};
    d.settings.cos = {
      provider: o.provider === 'oss' ? 'oss' : 'cos',
      ak: typeof o.ak === 'string' ? o.ak : '',
      sk: typeof o.sk === 'string' ? o.sk : '',
      bucket: typeof o.bucket === 'string' ? o.bucket : '',
      region: typeof o.region === 'string' ? o.region : '',
      key: typeof o.key === 'string' && o.key ? o.key : 'daily-hub/backup.json',
      auto: !!o.auto
    };
    return d;
  }

  /** 异步载入：IndexedDB 优先，其次迁移旧的 localStorage 数据 */
  function load() {
    return App.storage.get().then(function (raw) {
      if (raw == null) {
        var legacy = App.storage.readLegacy();
        if (legacy) {
          state = normalize(legacy);
          return App.storage.set(snapshot()).then(function (ok) {
            if (ok) App.storage.clearLegacy();
            return state;
          });
        }
        state = defaults();
        return state;
      }
      state = normalize(raw);
      return state;
    }).catch(function (e) {
      console.warn('读取本地数据失败', e);
      state = defaults();
      return state;
    });
  }

  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  /** 持久化（内存状态立即生效，落盘异步进行） */
  function save() {
    dirty = true;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, 120);
    return true;
  }

  function flush() {
    if (!dirty) return Promise.resolve(true);
    dirty = false;
    var data = snapshot();
    return App.storage.set(data).then(function (ok) {
      if (!ok && App.ui) App.ui.toast('数据写入失败，请留意备份', 'error');
      return ok;
    }).catch(function (e) {
      if (App.ui) App.ui.toast('数据写入失败：' + (e && e.message ? e.message : e), 'error');
      return false;
    });
  }

  /* ---------- 日志 ---------- */
  var diary = {
    get: function (date) {
      var v = state.diary[date];
      return v ? v.content : '';
    },
    set: function (date, content) {
      content = String(content || '');
      if (!content.trim()) delete state.diary[date];
      else state.diary[date] = { content: content, updatedAt: Date.now() };
      save();
    },
    remove: function (date) { delete state.diary[date]; save(); },
    sortedDates: function () { return Object.keys(state.diary).sort().reverse(); },
    count: function () { return Object.keys(state.diary).length; }
  };

  /* ---------- 倒数日 ---------- */
  var events = {
    all: function () { return state.events; },
    byId: function (id) {
      for (var i = 0; i < state.events.length; i++) if (state.events[i].id === id) return state.events[i];
      return null;
    },
    add: function (data) {
      var e = {
        id: U.uid(),
        title: String(data.title || '未命名').trim() || '未命名',
        date: data.date,
        note: data.note ? String(data.note) : '',
        createdAt: Date.now()
      };
      state.events.push(e);
      save();
      return e;
    },
    update: function (id, data) {
      var e = events.byId(id);
      if (!e) return null;
      if (data.title != null) e.title = String(data.title).trim() || '未命名';
      if (data.date) e.date = data.date;
      if (data.note != null) e.note = String(data.note);
      save();
      return e;
    },
    remove: function (id) {
      state.events = state.events.filter(function (e) { return e.id !== id; });
      save();
    },
    reorder: function (from, to) {
      U.move(state.events, from, to);
      save();
    }
  };

  /* ---------- 保养 ---------- */
  var care = {
    mileage: function () { return state.maintenance.mileage; },
    setMileage: function (km) {
      state.maintenance.mileage = Math.max(0, Math.round(Number(km) || 0));
      state.maintenance.mileageUpdatedAt = U.todayStr();
      save();
    },
    mileageUpdatedAt: function () { return state.maintenance.mileageUpdatedAt; },
    items: function () { return state.maintenance.items; },
    byId: function (id) {
      var list = state.maintenance.items;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    add: function (data) {
      var it = {
        id: U.uid(),
        name: String(data.name || '未命名项目').trim() || '未命名项目',
        intervalKm: Math.max(0, Math.round(Number(data.intervalKm) || 0)),
        intervalValue: Math.max(0, Number(data.intervalValue) || 0),
        intervalUnit: data.intervalUnit === 'day' ? 'day' : 'month',
        lastKm: Math.max(0, Math.round(Number(data.lastKm) || 0)),
        lastDate: U.isValidDate(data.lastDate) ? data.lastDate : U.todayStr(),
        note: data.note ? String(data.note) : '',
        createdAt: Date.now()
      };
      state.maintenance.items.push(it);
      save();
      return it;
    },
    update: function (id, data) {
      var it = care.byId(id);
      if (!it) return null;
      if (data.name != null) it.name = String(data.name).trim() || '未命名项目';
      if (data.intervalKm != null) it.intervalKm = Math.max(0, Math.round(Number(data.intervalKm) || 0));
      if (data.intervalValue != null) it.intervalValue = Math.max(0, Number(data.intervalValue) || 0);
      if (data.intervalUnit) it.intervalUnit = data.intervalUnit === 'day' ? 'day' : 'month';
      if (data.lastKm != null) it.lastKm = Math.max(0, Math.round(Number(data.lastKm) || 0));
      if (U.isValidDate(data.lastDate)) it.lastDate = data.lastDate;
      if (data.note != null) it.note = String(data.note);
      save();
      return it;
    },
    remove: function (id) {
      state.maintenance.items = state.maintenance.items.filter(function (i) { return i.id !== id; });
      save();
    },
    /** 标记已保养：基准重置为当前里程与今天 */
    done: function (id) {
      var it = care.byId(id);
      if (!it) return null;
      it.lastKm = state.maintenance.mileage;
      it.lastDate = U.todayStr();
      save();
      return it;
    },

    /**
     * 计算单个保养项目状态
     * 规则：剩余里程 ≤0 或 剩余天数 ≤0 → 超期(over)
     *       剩余里程 ≤1000 或 剩余天数 ≤30 → 临近(warn)
     *       其余 → 安全(safe)
     */
    status: function (item) {
      var current = state.maintenance.mileage;
      var nextKm = item.lastKm + item.intervalKm;
      var nextDate = item.intervalUnit === 'day'
        ? U.addDays(item.lastDate, item.intervalValue)
        : U.addMonths(item.lastDate, item.intervalValue);
      var remainKm = item.intervalKm > 0 ? (nextKm - current) : null;
      var remainDays = item.intervalValue > 0 ? U.diffDays(U.todayStr(), nextDate) : null;

      var status = 'safe';
      if ((remainKm !== null && remainKm <= 0) || (remainDays !== null && remainDays <= 0)) status = 'over';
      else if ((remainKm !== null && remainKm <= WARN_KM) || (remainDays !== null && remainDays <= WARN_DAYS)) status = 'warn';

      // 进度：取两个周期中消耗比例更大的一个
      var pct = 0;
      if (remainKm !== null && item.intervalKm > 0) {
        pct = Math.max(pct, (current - item.lastKm) / item.intervalKm);
      }
      if (remainDays !== null && item.intervalValue > 0) {
        var totalDays = item.intervalUnit === 'day'
          ? item.intervalValue
          : Math.max(1, U.diffDays(item.lastDate, nextDate));
        pct = Math.max(pct, (totalDays - remainDays) / totalDays);
      }
      pct = Math.min(1, Math.max(0, pct));

      return {
        nextKm: nextKm,
        nextDate: nextDate,
        remainKm: remainKm,
        remainDays: remainDays,
        status: status,
        percent: pct
      };
    }
  };

  App.store = {
    WARN_KM: WARN_KM,
    WARN_DAYS: WARN_DAYS,
    get state() { return state; },
    load: load,
    save: save,
    flush: flush,
    snapshot: snapshot,
    /** 数据占用字节数（UTF-8 估算） */
    sizeBytes: function () {
      try {
        return new Blob([JSON.stringify(state)]).size;
      } catch (e) {
        return JSON.stringify(state).length;
      }
    },
    replace: function (data) { state = normalize(data); save(); },
    diary: diary,
    events: events,
    care: care
  };
})(window.App);
