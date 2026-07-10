/* Urban Luxe — password-reset.js: восстановление пароля через Supabase.
   1) Ссылка «Забыли пароль?» в форме входа кабинета (#loginF) и в чат-авторизации (#chatAuth).
   2) Обработка ссылки из письма (#type=recovery в URL) — окно смены пароля.
   Письмо ведёт на Site URL проекта Supabase (https://urbanluxe.cc), поэтому модуль
   подключается на ОБЕ страницы:
     index.html:  <script src="/password-reset.js" defer></script>
     guest.html:  <script src="/password-reset.js" defer></script> */
(function () {
  'use strict';

  var SB_URL = 'https://sebvfvtofiysbywxjqut.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';

  var L = {
    ru: { forgot: 'Забыли пароль?', enterEmail: 'Введите email вашего аккаунта', sent: 'Письмо со ссылкой для смены пароля отправлено на ', sendErr: 'Не удалось отправить письмо: ',
      title: 'Новый пароль', pw1: 'Новый пароль', pw2: 'Повторите пароль', save: 'Сохранить', saving: 'Сохраняю…',
      rules: 'Минимум 8 символов, строчная и заглавная латинские буквы',
      short: 'Минимум 8 символов', needCase: 'Нужна хотя бы одна строчная и одна заглавная латинская буква', latinOnly: 'Только латинские буквы, цифры и символы (без кириллицы и пробелов)',
      mismatch: 'Пароли не совпадают', done: 'Пароль изменён — вы вошли в аккаунт', fail: 'Не получилось: ', linkDead: 'Ссылка устарела. Запросите новое письмо через «Забыли пароль?»' },
    en: { forgot: 'Forgot password?', enterEmail: 'Enter your account email', sent: 'Password reset link sent to ', sendErr: 'Could not send email: ',
      title: 'New password', pw1: 'New password', pw2: 'Repeat password', save: 'Save', saving: 'Saving…',
      rules: 'At least 8 characters with lowercase and uppercase Latin letters',
      short: 'At least 8 characters', needCase: 'Add at least one lowercase and one uppercase Latin letter', latinOnly: 'Latin letters, digits and symbols only (no spaces)',
      mismatch: 'Passwords do not match', done: 'Password changed — you are signed in', fail: 'Failed: ', linkDead: 'Link expired. Request a new email via "Forgot password?"' },
    uz: { forgot: 'Parolni unutdingizmi?', enterEmail: 'Akkaunt emailini kiriting', sent: 'Parolni tiklash havolasi yuborildi: ', sendErr: 'Xat yuborilmadi: ',
      title: 'Yangi parol', pw1: 'Yangi parol', pw2: 'Parolni takrorlang', save: 'Saqlash', saving: 'Saqlanmoqda…',
      rules: "Kamida 8 belgi, kichik va katta lotin harflari bo'lishi shart",
      short: 'Kamida 8 belgi', needCase: "Kamida bitta kichik va bitta katta lotin harfi kerak", latinOnly: "Faqat lotin harflari, raqamlar va belgilar (bo'sh joysiz)",
      mismatch: 'Parollar mos kelmadi', done: "Parol o'zgartirildi — akkauntga kirdingiz", fail: 'Xatolik: ', linkDead: "Havola eskirgan. «Parolni unutdingizmi?» orqali yangi xat so'rang" }
  };
  function t() { var l = (document.documentElement.lang || 'ru').slice(0, 2).toLowerCase(); return L[l] || L.ru; }

  var sbc = null;
  function sb() {
    if (!sbc && window.supabase && window.supabase.createClient) {
      sbc = window.supabase.createClient(SB_URL, SB_KEY, { auth: { detectSessionInUrl: false } });
    }
    return sbc;
  }

  // ---------- «Забыли пароль?» ----------
  function sendReset(email, msgEl) {
    var c = sb(); if (!c) return;
    var s = t();
    if (!email) { email = (prompt(s.enterEmail) || '').trim(); }
    if (!email || email.indexOf('@') < 0) return;
    c.auth.resetPasswordForEmail(email).then(function (r) {
      msgEl.textContent = r.error ? s.sendErr + r.error.message : s.sent + email;
      msgEl.style.color = r.error ? '#e88' : '#8c8';
    });
  }
  function addLink() {
    var s = t();
    [['loginF', 'aE'], ['chatAuth', 'chatLogin']].forEach(function (pair) {
      var form = document.getElementById(pair[0]);
      if (!form || form.querySelector('.ul-forgot')) return;
      var a = document.createElement('a');
      a.className = 'ul-forgot'; a.href = 'javascript:void(0)';
      a.textContent = s.forgot;
      a.style.cssText = 'display:block;margin-top:10px;font-size:13px;color:#c9a96e;text-decoration:underline;cursor:pointer';
      var msg = document.createElement('div');
      msg.style.cssText = 'font-size:12px;margin-top:6px;min-height:14px';
      a.onclick = function () {
        var em = document.getElementById(pair[1]);
        sendReset(em && em.value ? em.value.trim() : '', msg);
      };
      form.appendChild(a); form.appendChild(msg);
    });
  }

  // ---------- Обработка ссылки из письма ----------
  function hashParams() {
    var h = location.hash.replace(/^#/, ''), o = {};
    h.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) o[p[0]] = decodeURIComponent(p[1] || ''); });
    return o;
  }
  function showResetForm(tokens) {
    var s = t();
    var ov = document.createElement('div');
    ov.id = 'ul-pwreset';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';
    ov.innerHTML =
      '<div style="background:#161616;border:1px solid #333;border-radius:16px;padding:26px;max-width:380px;width:100%">' +
      '<h3 style="margin:0 0 8px;color:#fff;font-size:19px;font-weight:600">' + s.title + '</h3>' +
      '<p style="margin:0 0 14px;color:#8a857a;font-size:12px">' + s.rules + '</p>' +
      '<input type="password" id="ulpw1" placeholder="' + s.pw1 + '" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:#222;border:1px solid #3a3a3a;border-radius:9px;color:#eee;padding:12px;font-size:16px;margin-bottom:10px">' +
      '<input type="password" id="ulpw2" placeholder="' + s.pw2 + '" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:#222;border:1px solid #3a3a3a;border-radius:9px;color:#eee;padding:12px;font-size:16px;margin-bottom:12px">' +
      '<button id="ulpwGo" style="width:100%;background:#c9a96e;color:#241d10;border:0;border-radius:9px;padding:13px;font-size:15px;font-weight:600;cursor:pointer">' + s.save + '</button>' +
      '<div id="ulpwMsg" style="font-size:13px;margin-top:10px;min-height:16px;color:#e88"></div></div>';
    document.body.appendChild(ov);
    var msg = document.getElementById('ulpwMsg');
    document.getElementById('ulpwGo').onclick = function () {
      var p1 = document.getElementById('ulpw1').value, p2 = document.getElementById('ulpw2').value;
      msg.style.color = '#e88';
      if (p1.length < 8) { msg.textContent = s.short; return; }
      if (!/^[\x21-\x7E]+$/.test(p1)) { msg.textContent = s.latinOnly; return; }
      if (!/[a-z]/.test(p1) || !/[A-Z]/.test(p1)) { msg.textContent = s.needCase; return; }
      if (p1 !== p2) { msg.textContent = s.mismatch; return; }
      var btn = this; btn.disabled = true; btn.textContent = s.saving;
      var c = sb();
      c.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
        .then(function (r) {
          if (r.error) throw r.error;
          return c.auth.updateUser({ password: p1 });
        })
        .then(function (r) {
          if (r.error) throw r.error;
          msg.style.color = '#8c8'; msg.textContent = s.done;
          setTimeout(function () {
            history.replaceState(null, '', location.pathname);
            location.href = '/guest';
          }, 1200);
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = s.save;
          msg.style.color = '#e88';
          msg.textContent = /expired|invalid|token/i.test(String(e.message)) ? s.linkDead : s.fail + (e.message || e);
        });
    };
  }
  function checkRecovery() {
    var p = hashParams();
    if (p.type === 'recovery' && p.access_token && p.refresh_token) {
      var start = function () { if (document.getElementById('ul-pwreset')) return; showResetForm(p); };
      if (window.supabase) start();
      else { var n = 0, iv = setInterval(function () { if (window.supabase || ++n > 40) { clearInterval(iv); if (window.supabase) start(); } }, 250); }
    }
    if (p.error_code || (p.error_description && p.type !== 'recovery')) {
      alert(t().linkDead);
    }
  }

  function init() { addLink(); checkRecovery(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  var tries = 0, iv = setInterval(function () { addLink(); if (++tries > 30) clearInterval(iv); }, 400);
})();
