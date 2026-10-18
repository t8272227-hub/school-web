// Слияние данных телефона и компьютера. Та же логика, что в SyncRules.kt.
(function (root) {
  var TTL = 30 * 24 * 3600 * 1000;

  function normalize(v) {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) { o[k] = normalize(v[k]); });
      return o;
    }
    return v;
  }
  function eq(a, b) { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }
  function updatedOf(r) { return (r && typeof r.updated === 'number') ? r.updated : 0; }
  function isDeleted(r) { return !!(r && r.deleted === true); }

  // Победа новой записи; при равенстве остаётся локальная (a).
  function merge(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) {
      if (!out[k] || updatedOf(b[k]) > updatedOf(out[k])) out[k] = b[k];
    });
    return out;
  }
  function prune(m, now) {
    var out = {};
    Object.keys(m).forEach(function (k) {
      if (!(isDeleted(m[k]) && now - updatedOf(m[k]) > TTL)) out[k] = m[k];
    });
    return out;
  }
  function live(m) {
    return Object.keys(m || {}).map(function (k) { return m[k]; }).filter(function (r) { return !isDeleted(r); });
  }
  // Запись изменена или создана на этом устройстве.
  function put(m, rec, now) { m[rec.id] = Object.assign({}, rec, { updated: now }); delete m[rec.id].deleted; }
  function remove(m, id, now) { m[id] = { id: id, deleted: true, updated: now }; }

  // Правила родителя: побеждают более новые. Подпись PIN проверяет телефон перед применением.
  function newerParent(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return updatedOf(b) > updatedOf(a) ? b : a;
  }
  // Минуты в приложении: устройство -> дата -> минуты, берём максимум.
  function mergeUsage(a, b) {
    var out = {};
    [a || {}, b || {}].forEach(function (src) {
      Object.keys(src).forEach(function (dev) {
        out[dev] = out[dev] || {};
        Object.keys(src[dev] || {}).forEach(function (d) { out[dev][d] = Math.max(out[dev][d] || 0, src[dev][d] || 0); });
      });
    });
    return out;
  }

  function mergeSnap(local, remote, now) {
    return {
      v: 1,
      mistakes: prune(merge(local.mistakes, remote.mistakes), now),
      notes: prune(merge(local.notes, remote.notes), now),
      profile: merge(local.profile, remote.profile),
      parent: newerParent(local.parent, remote.parent),
      usage: mergeUsage(local.usage, remote.usage),
      alerts: prune(merge(local.alerts, remote.alerts), now),
      accounts: prune(merge(local.accounts, remote.accounts), now),
      days: Array.from(new Set((local.days || []).concat(remote.days || []))).sort(),
      tasks: Math.max(local.tasks || 0, remote.tasks || 0),
    };
  }

  function toWire(s) {
    function recs(m) { return Object.keys(m || {}).sort().map(function (k) { return m[k]; }); }
    return { v: 1, mistakes: recs(s.mistakes), notes: recs(s.notes), profile: recs(s.profile), parent: s.parent || null, days: (s.days || []).slice().sort(), tasks: s.tasks || 0, usage: s.usage || {}, alerts: recs(s.alerts), accounts: recs(s.accounts) };
  }
  function fromWire(o) {
    if (!o || typeof o !== 'object' || o.v == null) return null;
    function map(a) {
      var m = {};
      (Array.isArray(a) ? a : []).forEach(function (r) { if (r && r.id != null) m[String(r.id)] = r; });
      return m;
    }
    return { v: 1, mistakes: map(o.mistakes), notes: map(o.notes), profile: map(o.profile), parent: o.parent || null, days: Array.isArray(o.days) ? o.days : [], tasks: typeof o.tasks === 'number' ? o.tasks : 0, usage: (o.usage && typeof o.usage === 'object') ? o.usage : {}, alerts: map(o.alerts), accounts: map(o.accounts) };
  }
  function emptySnap() { return { v: 1, mistakes: {}, notes: {}, profile: {}, parent: null, days: [], tasks: 0, usage: {}, alerts: {}, accounts: {} }; }
  function sameSnap(a, b) { return eq(toWire(a), toWire(b)); }

  // Серия занятий подряд (считаем назад от сегодня или вчера).
  function streak(days, today) {
    var set = {}; days.forEach(function (d) { set[d] = 1; });
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    var d = new Date(today || new Date());
    if (!set[iso(d)]) d.setDate(d.getDate() - 1);
    var n = 0;
    while (set[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  var api = { TTL: TTL, merge: merge, prune: prune, live: live, put: put, remove: remove, mergeSnap: mergeSnap, mergeUsage: mergeUsage, newerParent: newerParent, toWire: toWire, fromWire: fromWire, emptySnap: emptySnap, sameSnap: sameSnap, streak: streak, updatedOf: updatedOf, isDeleted: isDeleted };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KidSync = api;
})(typeof window !== 'undefined' ? window : this);
