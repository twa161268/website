//-------------------------------------- MULAI APP.JS

require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const methodOverride = require('method-override');
const db = require('./config/db');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/admin/dashboard');
const artikelRoutes = require('./routes/admin/artikel');
const gambarRoutes = require('./routes/admin/gambar');
const tulisanRoutes = require('./routes/admin/tulisan');

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'user_sessions',
    schemaName: 'public',
    createTableIfMissing: true,
    pruneSessionInterval: 900
  }),
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  name: 'website.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentRole = req.session.role || null;
  next();
});

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/admin', dashboardRoutes);
app.use('/admin/artikel', artikelRoutes);
app.use('/admin/gambar', gambarRoutes);
app.use('/admin/tulisan', tulisanRoutes);

app.use((req, res) => {
  res.status(404).render('error', { status: 404, message: 'Halaman tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('error', { status: 400, message: 'Ukuran file terlalu besar.' });
  }
  if (err.message && err.message.startsWith('File tidak didukung')) {
    return res.status(400).render('error', { status: 400, message: err.message });
  }
  return res.status(500).render('error', { status: 500, message: 'Terjadi kesalahan pada server.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));



/*
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const mloginRoutes = require('./routes/mloginRoutes');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
const app = express();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET belum diset pada environment production.');
}

app.set('trust proxy', 1);

app.use(
  session({
    store: new pgSession({
      pool: db.pool,
      schemaName: 'public',
      tableName: 'user_sessions',
      pruneSessionInterval: 900,
      disableTouch: true,
    }),

    secret: process.env.SESSION_SECRET || 'secret123',
    name: 'vch.sid',
    resave: false,
    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//----------------Ini saat Menu terbuka-----------
app.get('/', (req, res) => {
  res.render('index', {
    isLogin: !!req.session.user,
    user: req.session.user || null,
  });
});

//-----------------------------------------------

app.use('/mlogin', mloginRoutes);
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`Server berjalan di http://localhost:${PORT}`)
 ); */
