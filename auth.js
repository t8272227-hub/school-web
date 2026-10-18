// Логины и пароли для входа на компьютере. Пароль нигде не хранится: только соль и PBKDF2-хеш.
// Аккаунты лежат в синхронизируемых данных (как записи с полем updated), поэтому работают на любом компьютере семьи.
(function (root) {
  var ITER = 150000, enc = new TextEncoder();
  function subtle() { return (root.crypto && root.crypto.subtle) || require('crypto').webcrypto.subtle; }
  function rnd(n) { var a = new Uint8Array(n); (root.crypto || require('crypto').webcrypto).getRandomValues(a); return a; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function normLogin(s) { return String(s || '').trim().toLowerCase(); }
  function checkLogin(s) { var l = normLogin(s); if (l.length < 3) return 'Логин: не короче 3 символов.'; if (!/^[a-zа-яё0-9._-]+$/i.test(l)) return 'Логин: только буквы, цифры и . _ -'; return ''; }
  function checkPassword(p) { p = String(p || ''); if (p.length < 6) return 'Пароль: не короче 6 символов.'; return ''; }
  function hash(pw, saltHex) {
    var s = subtle(), salt = new Uint8Array(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    return s.importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: ITER }, k, 256);
    }).then(hex);
  }
  // role: 'parent' | 'child'
  function make(login, role, pw, now) {
    var salt = hex(rnd(16)), l = normLogin(login);
    return hash(pw, salt).then(function (h) { return { id: 'u:' + l, login: l, role: role === 'parent' ? 'parent' : 'child', salt: salt, hash: h, iter: ITER, updated: now }; });
  }
  function verify(rec, pw) {
    if (!rec || typeof rec.salt !== 'string' || typeof rec.hash !== 'string') return Promise.resolve(false);
    return hash(pw, rec.salt).then(function (h) { return h === rec.hash; });
  }
  function live(accounts) { return Object.keys(accounts || {}).map(function (k) { return accounts[k]; }).filter(function (r) { return r && !r.deleted && r.login; }); }
  function find(accounts, login) { var r = (accounts || {})['u:' + normLogin(login)]; return r && !r.deleted ? r : null; }
  var api = { ITER: ITER, normLogin: normLogin, checkLogin: checkLogin, checkPassword: checkPassword, make: make, verify: verify, live: live, find: find };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KidAuth = api;
})(typeof window !== 'undefined' ? window : globalThis);
