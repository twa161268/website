const fs = require('fs');
const path = require('path');
const db = require('../../config/db');

const uploadRoot = path.resolve(__dirname, '../../public/uploads');
function removeFile(filePath) {
  if (!filePath) return;
  const full = path.resolve(
    __dirname,
    '../../public',
    filePath.replace(/^\/+/, '')
  );
  if (!full.startsWith(uploadRoot + path.sep)) return;
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (err) {
    console.error(err);
  }
}
function slugify(v) {
  return (
    String(v || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 240) || 'gambar'
  );
}
async function uniqueSlug(slug, excludeId = null) {
  const base = slugify(slug);
  let c = base,
    n = 2;
  while (true) {
    const p = [c];
    let q = 'SELECT id FROM gambar WHERE slug=$1';
    if (excludeId) {
      q += ' AND id<>$2';
      p.push(excludeId);
    }
    if (!(await db.query(q, p))[0]) return c;
    c = `${base}-${n++}`.slice(0, 250);
  }
}
const categories = ['BACK', 'FORM', 'GALLERY', 'PRODUK', 'SOSMED'];
async function index(req, res, next) {
  try {
    const items = await db.query(
      'SELECT * FROM gambar ORDER BY created_at DESC'
    );
    res.render('admin/gambar/index', { items });
  } catch (e) {
    next(e);
  }
}
function showCreate(req, res) {
  res.render('admin/gambar/tambah', { item: null, categories, error: null });
}
async function create(req, res, next) {
  const file = req.file;
  try {
    const judul = String(req.body.judul || '').trim();
    if (!judul) throw new Error('Judul gambar wajib diisi.');
    const kategori = String(req.body.kategori || '');
    if (!categories.includes(kategori))
      throw new Error('Kategori tidak valid.');
    if (!file) throw new Error('File wajib dipilih.');
    const slug = await uniqueSlug(req.body.slug || judul);
    const dbPath = `/uploads/gambar/${file.filename}`;
    await db.query(
      'INSERT INTO gambar (judul,slug,gambar,status,statuspin,created_at,updated_at,kategori) VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),$6)',
      [
        judul,
        slug,
        dbPath,
        req.body.status === '1' ? '1' : '0',
        req.body.statuspin === '1' ? '1' : '0',
        kategori,
      ]
    );
    res.redirect('/admin/gambar');
  } catch (e) {
    if (file) removeFile(`/uploads/gambar/${file.filename}`);
    if (e.message && !e.code)
      return res.status(400).render('admin/gambar/tambah', {
        item: req.body,
        categories,
        error: e.message,
      });
    next(e);
  }
}
async function showEdit(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM gambar WHERE id=$1', [
      req.params.id,
    ]);
    if (!rows[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Gambar tidak ditemukan.' });
    res.render('admin/gambar/edit', { item: rows[0], categories, error: null });
  } catch (e) {
    next(e);
  }
}
async function update(req, res, next) {
  const file = req.file;
  try {
    const id = Number(req.params.id);
    const rows = await db.query('SELECT * FROM gambar WHERE id=$1', [id]);
    if (!rows[0]) {
      if (file) removeFile(`/uploads/gambar/${file.filename}`);
      return res
        .status(404)
        .render('error', { status: 404, message: 'Gambar tidak ditemukan.' });
    }
    const judul = String(req.body.judul || '').trim();
    const kategori = String(req.body.kategori || '');
    if (!judul) throw new Error('Judul gambar wajib diisi.');
    if (!categories.includes(kategori))
      throw new Error('Kategori tidak valid.');
    const slug = await uniqueSlug(req.body.slug || judul, id);
    let dbPath = rows[0].gambar;
    if (file) dbPath = `/uploads/gambar/${file.filename}`;
    await db.query(
      'UPDATE gambar SET judul=$1,slug=$2,gambar=$3,status=$4,statuspin=$5,updated_at=NOW(),kategori=$6 WHERE id=$7',
      [
        judul,
        slug,
        dbPath,
        req.body.status === '1' ? '1' : '0',
        req.body.statuspin === '1' ? '1' : '0',
        kategori,
        id,
      ]
    );
    if (file) removeFile(rows[0].gambar);
    res.redirect('/admin/gambar');
  } catch (e) {
    if (file) removeFile(`/uploads/gambar/${file.filename}`);
    if (e.message && !e.code) {
      const rows = await db.query('SELECT * FROM gambar WHERE id=$1', [
        req.params.id,
      ]);
      return res.status(400).render('admin/gambar/edit', {
        item: { ...rows[0], ...req.body },
        categories,
        error: e.message,
      });
    }
    next(e);
  }
}
async function remove(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM gambar WHERE id=$1', [
      req.params.id,
    ]);
    if (!rows[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Gambar tidak ditemukan.' });
    await db.query('DELETE FROM gambar WHERE id=$1', [req.params.id]);
    removeFile(rows[0].gambar);
    res.redirect('/admin/gambar');
  } catch (e) {
    next(e);
  }
}
module.exports = {
  index,
  showCreate,
  create,
  showEdit,
  update,
  remove,
  categories,
};
