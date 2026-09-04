const db = require('../../config/db');
function slugify(v) {
  return (
    String(v || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 240) || 'tulisan'
  );
}
async function uniqueSlug(slug, excludeId = null) {
  const base = slugify(slug);
  let c = base,
    n = 2;
  while (true) {
    const p = [c];
    let q = 'SELECT id FROM tulisan WHERE slug=$1';
    if (excludeId) {
      q += ' AND id<>$2';
      p.push(excludeId);
    }
    if (!(await db.query(q, p))[0]) return c;
    c = `${base}-${n++}`.slice(0, 250);
  }
}
async function index(req, res, next) {
  try {
    const items = await db.query(
      'SELECT * FROM tulisan ORDER BY statuspin DESC, created_at DESC'
    );
    res.render('admin/tulisan/index', { items });
  } catch (e) {
    next(e);
  }
}
function showCreate(req, res) {
  res.render('admin/tulisan/tambah', { item: null, error: null });
}
async function create(req, res, next) {
  try {
    const judul = String(req.body.judul || '').trim();
    if (!judul) throw new Error('Judul tulisan wajib diisi.');
    const slug = await uniqueSlug(req.body.slug || judul);
    await db.query(
      'INSERT INTO tulisan (judul,slug,isi,status,statuspin,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
      [
        judul,
        slug,
        req.body.isi || '',
        req.body.status === '1' ? '1' : '0',
        req.body.statuspin === '1' ? '1' : '0',
      ]
    );
    res.redirect('/admin/tulisan');
  } catch (e) {
    if (e.message && !e.code)
      return res
        .status(400)
        .render('admin/tulisan/tambah', { item: req.body, error: e.message });
    next(e);
  }
}
async function showEdit(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM tulisan WHERE id=$1', [
      req.params.id,
    ]);
    if (!rows[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Tulisan tidak ditemukan.' });
    res.render('admin/tulisan/edit', { item: rows[0], error: null });
  } catch (e) {
    next(e);
  }
}
async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const rows = await db.query('SELECT id FROM tulisan WHERE id=$1', [id]);
    if (!rows[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Tulisan tidak ditemukan.' });
    const judul = String(req.body.judul || '').trim();
    if (!judul) throw new Error('Judul tulisan wajib diisi.');
    const slug = await uniqueSlug(req.body.slug || judul, id);
    await db.query(
      'UPDATE tulisan SET judul=$1,slug=$2,isi=$3,status=$4,statuspin=$5,updated_at=NOW() WHERE id=$6',
      [
        judul,
        slug,
        req.body.isi || '',
        req.body.status === '1' ? '1' : '0',
        req.body.statuspin === '1' ? '1' : '0',
        id,
      ]
    );
    res.redirect('/admin/tulisan');
  } catch (e) {
    if (e.message && !e.code) {
      const rows = await db.query('SELECT * FROM tulisan WHERE id=$1', [
        req.params.id,
      ]);
      return res
        .status(400)
        .render('admin/tulisan/edit', {
          item: { ...rows[0], ...req.body },
          error: e.message,
        });
    }
    next(e);
  }
}
async function remove(req, res, next) {
  try {
    const rows = await db.query('SELECT id FROM tulisan WHERE id=$1', [
      req.params.id,
    ]);
    if (!rows[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Tulisan tidak ditemukan.' });
    await db.query('DELETE FROM tulisan WHERE id=$1', [req.params.id]);
    res.redirect('/admin/tulisan');
  } catch (e) {
    next(e);
  }
}
module.exports = { index, showCreate, create, showEdit, update, remove };
