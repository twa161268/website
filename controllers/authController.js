const bcrypt = require('bcrypt');
const svgCaptcha = require('svg-captcha');
const db = require('../config/db');

function newCaptcha(req) {
  const captcha = svgCaptcha.create({ size: 5, noise: 2, color: false, background: '#ffffff' });
  req.session.captcha = captcha.text;
  return captcha.data;
}

function renderLogin(req, res, error = null) {
  return res.render('public/login', { captcha: newCaptcha(req), error, username: '' });
}

function showLogin(req, res) {
  if (req.session.user) return res.redirect('/admin');
  return renderLogin(req, res);
}

async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const captchaInput = String(req.body.captcha || '').trim().toLowerCase();
    const captchaStored = String(req.session.captcha || '').trim().toLowerCase();

    if (!captchaStored || captchaInput !== captchaStored) return renderLogin(req, res, 'Captcha salah.');
    if (!username || !password) return renderLogin(req, res, 'Username dan password wajib diisi.');

    const rows = await db.query('SELECT user_id, username, password_hash, fullname, role, is_active FROM users WHERE username = $1 LIMIT 1', [username]);
    const user = rows[0];
    if (!user) return renderLogin(req, res, 'Username atau password salah.');
    if (!user.is_active) return renderLogin(req, res, 'User tidak aktif.');
    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) return renderLogin(req, res, 'Username atau password salah.');

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = username;
      req.session.userId = user.user_id;
      req.session.fullname = user.fullname;
      req.session.role = user.role;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect('/admin');
      });
    });
  } catch (err) { next(err); }
}

function logout(req, res, next) {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('website.sid');
    res.redirect('/');
  });
}

module.exports = { showLogin, login, logout };
