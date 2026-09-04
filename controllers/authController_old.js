//------------------------------MULAI AUTHCONTROLLER.JS
const svgCaptcha = require('svg-captcha');
const bcrypt = require('bcrypt');
const db = require('../db');

// simulasi user (bisa dari database nanti)
const users = [
  {
    username: 'admin',
    password_hash: bcrypt.hashSync('12345', 10),
  },
];

// tampilkan halaman login
exports.showLogin = (req, res) => {
  const captcha = svgCaptcha.create();
  req.session.captcha = captcha.text;
  //console.log("SHOW CAPTCHA:", captcha.text);
  //console.log("SHOW CAPTCHA IN SESSION:", req.session.captcha);
  res.render('login', {
    captcha: captcha.data,
    error: null,
  });
};

// proses login
exports.login = async (req, res) => {
  const { username, password, captcha } = req.body;
  //console.log("Captcha yang dimasukkan:", captcha)
  //console.log("Captcha yang disimpan di session:", req.session.captcha)

  // cek captcha
  if (captcha.trim().toLowerCase() !== req.session.captcha.toLowerCase()) {
    const newCaptcha = svgCaptcha.create();
    req.session.captcha = newCaptcha.text;

    return req.session.save(() => {
      res.render('login', {
        captcha: newCaptcha.data,
        error: 'Captcha salah',
      });
    });
  }

  //const user = users.find(u => u.username === username);

  const result = await db.query('SELECT * FROM users WHERE username = $1', [
    username,
  ]);

  const user = result[0]; // atau result.rows[0] tergantung db kamu

  if (!user) {
    const newCaptcha = svgCaptcha.create();
    req.session.captcha = newCaptcha.text;

    return res.render('login', {
      captcha: newCaptcha.data,
      error: 'User tidak ditemukan',
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    const newCaptcha = svgCaptcha.create();
    req.session.captcha = newCaptcha.text;

    return res.render('login', {
      captcha: newCaptcha.data,
      error: 'Password salah',
    });
  }

  if (!user.is_active) {
    const newCaptcha = svgCaptcha.create();
    req.session.captcha = newCaptcha.text;

    return req.session.save(() => {
      res.render('login', {
        captcha: newCaptcha.data,
        error: 'User tidak aktif',
      });
    });
  }

  // ========================================
  // AMBIL PARAMETER GLOBAL APLIKASI
  // ========================================
  const resultParam = await db.query(`
  SELECT pricecode, company
  FROM public.param
  LIMIT 1
`);

  const param = resultParam[0];

  if (!param) {
    return res.render('login', {
      captcha: req.session.captcha,
      error: 'Parameter aplikasi belum tersedia',
    });
  }

  // ========================================
  // SIMPAN USER & PARAMETER KE SESSION
  // ========================================
  // Buat session ID baru setelah login berhasil untuk mencegah session fixation.
  // Data login kemudian disimpan ke PostgreSQL session store sebelum redirect.
  req.session.regenerate((err) => {
    if (err) {
      console.error('Gagal membuat session login:', err);
      return res.status(500).render('login', {
        captcha: req.session.captcha,
        error: 'Gagal membuat session login',
      });
    }

    req.session.user = username;
    req.session.stkid = user.stkid;
    req.session.role = user.role;
    req.session.stkid = user.stkid;

    req.session.param = {
      pricecode: param.pricecode,
      company: param.company,
    };

    req.session.captcha = null;

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Gagal menyimpan session login:', saveErr);
        return res.status(500).render('login', {
          captcha: '',
          error: 'Gagal menyimpan session login',
        });
      }

      return res.redirect('/');
    });
  });

  //  req.session.user = username;
  //  req.session.captcha = null;
  //  return res.redirect('/');
};

// logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};
