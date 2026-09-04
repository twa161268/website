const db = require('../../config/db');

async function index(req, res, next) {
  try {
    const rows = await Promise.all([
      db.query('SELECT COUNT(*)::int AS total FROM artikel'),
      db.query('SELECT COUNT(*)::int AS total FROM gambar'),
      db.query('SELECT COUNT(*)::int AS total FROM tulisan')
    ]);
    res.render('admin/dashboard', { counts: { artikel: rows[0][0].total, gambar: rows[1][0].total, tulisan: rows[2][0].total } });
  } catch (err) { next(err); }
}

module.exports = { index };
