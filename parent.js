// Правила родителя на компьютере: подпись PIN (как в ParentSig.kt) и расписание/лимит (как в ParentRules.kt).
(function (root) {
  var SALT = 'kid-parent-v1', ITER = 100000;
  var enc = new TextEncoder();
  function subtle() { return (root.crypto && root.crypto.subtle) || require('crypto').webcrypto.subtle; }

  var DEFAULT = { blocked: [], hintOnly: false, scheduleOn: false, fromMin: 420, toMin: 1260, limitMin: 0 };

  function deriveKey(pin) {
    var s = subtle();
    return s.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ITER }, base, 256);
    }).then(function (bits) { return s.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); });
  }
  function canonical(c, updated) {
    return 'v1|b=' + (c.blocked || []).slice().sort().join(',') + '|h=' + (c.hintOnly ? 1 : 0) + '|s=' + (c.scheduleOn ? 1 : 0) +
      '|f=' + c.fromMin + '|t=' + c.toMin + '|l=' + c.limitMin + '|u=' + updated;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sign(c, updated, key) { return subtle().sign('HMAC', key, enc.encode(canonical(c, updated))).then(hex); }
  function coreOf(rec) {
    if (!rec || !Array.isArray(rec.blocked)) return null;
    var n = function (k) { return typeof rec[k] === 'number' ? Math.round(rec[k]) : null; };
    if (n('fromMin') == null || n('toMin') == null || n('limitMin') == null) return null;
    return { blocked: rec.blocked.filter(function (x) { return typeof x === 'string'; }), hintOnly: rec.hintOnly === true, scheduleOn: rec.scheduleOn === true, fromMin: n('fromMin'), toMin: n('toMin'), limitMin: n('limitMin') };
  }
  function verify(rec, key) {
    var c = coreOf(rec);
    if (!c || typeof rec.sig !== 'string' || typeof rec.updated !== 'number') return Promise.resolve(false);
    return sign(c, rec.updated, key).then(function (s) { return s === rec.sig; });
  }
  function makeRec(c, key, now) {
    var updated = now || Date.now();
    var core = { blocked: (c.blocked || []).slice().sort(), hintOnly: !!c.hintOnly, scheduleOn: !!c.scheduleOn, fromMin: c.fromMin, toMin: c.toMin, limitMin: c.limitMin };
    return sign(core, updated, key).then(function (sig) { return Object.assign({}, core, { updated: updated, sig: sig }); });
  }

  // ----- расписание и лимит -----
  function fmt(m) { return ('0' + (Math.floor(m / 60) % 24)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function parseTime(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); if (!m) return null; var h = +m[1], mi = +m[2]; return (h > 23 || mi > 59) ? null : h * 60 + mi; }
  function inSchedule(c, minute) {
    if (!c.scheduleOn || c.fromMin === c.toMin) return true;
    return c.fromMin < c.toMin ? (minute >= c.fromMin && minute < c.toMin) : (minute >= c.fromMin || minute < c.toMin);
  }
  // 'schedule' | 'limit' | null
  function lockReason(c, minute, usedSec, overrideActive) {
    if (overrideActive) return null;
    if (!inSchedule(c, minute)) return 'schedule';
    if (c.limitMin > 0 && usedSec >= c.limitMin * 60) return 'limit';
    return null;
  }
  function lockMessage(reason, c) {
    return reason === 'schedule' ? 'Сейчас время отдыха. Учиться можно с ' + fmt(c.fromMin) + ' до ' + fmt(c.toMin) + '.'
      : 'На сегодня время закончилось (' + c.limitMin + ' мин). Пора отдохнуть: встань, попей воды, выйди на улицу.';
  }
  function minutesLeft(c, usedSec) { return c.limitMin > 0 ? Math.floor(Math.max(0, c.limitMin * 60 - usedSec) / 60) : null; }

  var api = { DEFAULT: DEFAULT, deriveKey: deriveKey, canonical: canonical, sign: sign, verify: verify, makeRec: makeRec, coreOf: coreOf, fmt: fmt, parseTime: parseTime, inSchedule: inSchedule, lockReason: lockReason, lockMessage: lockMessage, minutesLeft: minutesLeft };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KidParent = api;
})(typeof window !== 'undefined' ? window : globalThis);
