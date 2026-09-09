const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../../config/db');
const supabase = require('../../config/supabase');

const BUCKET = 'website-images';
const FOLDER = 'artikel';

const uploadRoot = path.resolve(__dirname, '../../public/uploads');

function safeFilePath(filePath) {
  if (!filePath) return null;

  const absolute = path.resolve(
    __dirname,
    '../../public',
    filePath.replace(/^\/+/, '')
  );

  return absolute.startsWith(uploadRoot + path.sep) ? absolute : null;
}

function removeLocalFile(filePath) {
  const full = safeFilePath(filePath);

  if (!full) return;

  try {
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
  } catch (err) {
    console.error('Gagal menghapus file lokal:', err);
  }
}

function getStoragePath(filePath) {
  if (!filePath) return null;

  // URL Supabase:
  // https://xxxx.supabase.co/storage/v1/object/public/website-images/artikel/file.jpg
  const marker = `/storage/v1/object/public/${BUCKET}/`;

  if (filePath.includes(marker)) {
    return decodeURIComponent(
      filePath.substring(filePath.indexOf(marker) + marker.length)
    );
  }

  // Format lama jika suatu saat tersimpan seperti:
  // /storage/artikel/file.jpg
  if (filePath.startsWith('/storage/artikel/')) {
    return filePath.substring('/storage/artikel/'.length);
  }

  return null;
}

async function removeSupabaseFile(filePath) {
  const storagePath = getStoragePath(filePath);

  if (!storagePath) return;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);

    if (error) {
      console.error('Gagal menghapus file Supabase:', error);
    }
  } catch (err) {
    console.error('Gagal menghapus file Supabase:', err);
  }
}

async function removeStoredFile(filePath) {
  if (!filePath) return;

  if (getStoragePath(filePath)) {
    await removeSupabaseFile(filePath);
  } else {
    // Untuk gambar Artikel lama yang masih berada di local storage
    removeLocalFile(filePath);
  }
}

function slugify(value) {
  return (
    String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 240) || 'artikel'
  );
}

async function uniqueSlug(slug, excludeId = null) {
  const base = slugify(slug);
  let candidate = base;
  let n = 2;

  while (true) {
    const params = [candidate];

    let sql = 'SELECT id FROM artikel WHERE slug = $1';

    if (excludeId) {
      sql += ' AND id <> $2';
      params.push(excludeId);
    }

    const rows = await db.query(sql, params);

    if (!rows[0]) return candidate;

    candidate = `${base}-${n++}`.slice(0, 250);
  }
}

async function uploadToSupabase(file) {
  if (!file || !file.buffer) {
    throw new Error('File upload tidak ditemukan.');
  }

  const ext = path.extname(file.originalname).toLowerCase();

  const filename = `${Date.now()}-${crypto
    .randomBytes(8)
    .toString('hex')}${ext}`;

  const storagePath = `${FOLDER}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload ke Supabase gagal: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

async function index(req, res, next) {
  try {
    const articles = await db.query(
      'SELECT * FROM artikel ORDER BY statuspin DESC, created_at DESC'
    );

    res.render('admin/artikel/index', { articles });
  } catch (err) {
    next(err);
  }
}

function showCreate(req, res) {
  res.render('admin/artikel/tambah', {
    article: null,
    images: [],
    error: null,
  });
}

async function create(req, res, next) {
  const files = req.files || [];
  const uploadedFiles = [];

  const client = await db.pool.connect();

  try {
    const judul = String(req.body.judul || '').trim();

    if (!judul) {
      throw new Error('Judul artikel wajib diisi.');
    }

    const slug = await uniqueSlug(String(req.body.slug || judul).trim());

    const isi = req.body.isi || '';
    const status = req.body.status === '1' ? '1' : '0';
    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    // Upload semua file ke Supabase terlebih dahulu
    for (const file of files) {
      const uploaded = await uploadToSupabase(file);
      uploadedFiles.push(uploaded);
    }

    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO artikel
       (judul, slug, isi, status, statuspin, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       RETURNING id`,
      [judul, slug, isi, status, statuspin]
    );

    const articleId = inserted.rows[0].id;

    for (let i = 0; i < uploadedFiles.length; i++) {
      await client.query(
        `INSERT INTO artikel_gambar
         (artikel_id, gambar, urutan, created_at)
         VALUES ($1,$2,$3,NOW())`,
        [articleId, uploadedFiles[i].publicUrl, i + 1]
      );
    }

    await client.query('COMMIT');

    res.redirect(`/admin/artikel/detail/${articleId}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // Jika DB gagal setelah upload Supabase,
    // hapus file yang sudah terlanjur di-upload.
    for (const uploaded of uploadedFiles) {
      await removeSupabaseFile(uploaded.publicUrl);
    }

    if (err.message && !err.code) {
      return res.status(400).render('admin/artikel/tambah', {
        article: req.body,
        images: [],
        error: err.message,
      });
    }

    next(err);
  } finally {
    client.release();
  }
}

async function detail(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel WHERE id = $1', [
      req.params.id,
    ]);

    if (!rows[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    const images = await db.query(
      `SELECT * FROM artikel_gambar
       WHERE artikel_id = $1
       ORDER BY urutan ASC, id ASC`,
      [req.params.id]
    );

    res.render('admin/artikel/detail', {
      article: rows[0],
      images,
    });
  } catch (err) {
    next(err);
  }
}

async function showEdit(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel WHERE id = $1', [
      req.params.id,
    ]);

    if (!rows[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    const images = await db.query(
      `SELECT * FROM artikel_gambar
       WHERE artikel_id = $1
       ORDER BY urutan ASC, id ASC`,
      [req.params.id]
    );

    res.render('admin/artikel/edit', {
      article: rows[0],
      images,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  const files = req.files || [];
  const uploadedFiles = [];

  const client = await db.pool.connect();

  try {
    const id = Number(req.params.id);

    const existing = await client.query('SELECT * FROM artikel WHERE id = $1', [
      id,
    ]);

    if (!existing.rows[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    const judul = String(req.body.judul || '').trim();

    if (!judul) {
      throw new Error('Judul artikel wajib diisi.');
    }

    const slug = await uniqueSlug(String(req.body.slug || judul).trim(), id);

    const status = req.body.status === '1' ? '1' : '0';
    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    // Upload gambar baru ke Supabase
    for (const file of files) {
      const uploaded = await uploadToSupabase(file);
      uploadedFiles.push(uploaded);
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE artikel
       SET judul=$1,
           slug=$2,
           isi=$3,
           status=$4,
           statuspin=$5,
           updated_at=NOW()
       WHERE id=$6`,
      [judul, slug, req.body.isi || '', status, statuspin, id]
    );

    const ids = Array.isArray(req.body.image_ids)
      ? req.body.image_ids
      : req.body.image_ids
        ? [req.body.image_ids]
        : [];

    const orders = Array.isArray(req.body.image_orders)
      ? req.body.image_orders
      : req.body.image_orders
        ? [req.body.image_orders]
        : [];

    for (let i = 0; i < ids.length; i++) {
      const imageId = Number(ids[i]);
      const order = Number(orders[i]) || i + 1;

      if (Number.isInteger(imageId)) {
        await client.query(
          `UPDATE artikel_gambar
           SET urutan=$1
           WHERE id=$2 AND artikel_id=$3`,
          [order, imageId, id]
        );
      }
    }

    const count = await client.query(
      `SELECT COALESCE(MAX(urutan),0) AS max_order
       FROM artikel_gambar
       WHERE artikel_id=$1`,
      [id]
    );

    let nextOrder = Number(count.rows[0].max_order) + 1;

    for (const uploaded of uploadedFiles) {
      await client.query(
        `INSERT INTO artikel_gambar
         (artikel_id, gambar, urutan, created_at)
         VALUES ($1,$2,$3,NOW())`,
        [id, uploaded.publicUrl, nextOrder++]
      );
    }

    await client.query('COMMIT');

    res.redirect(`/admin/artikel/edit/${id}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // Bersihkan file baru yang ter-upload jika proses DB gagal
    for (const uploaded of uploadedFiles) {
      await removeSupabaseFile(uploaded.publicUrl);
    }

    if (err.message && !err.code) {
      const images = await db.query(
        `SELECT * FROM artikel_gambar
         WHERE artikel_id=$1
         ORDER BY urutan,id`,
        [req.params.id]
      );

      return res.status(400).render('admin/artikel/edit', {
        article: {
          ...req.body,
          id: req.params.id,
        },
        images,
        error: err.message,
      });
    }

    next(err);
  } finally {
    client.release();
  }
}

async function deleteImage(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel_gambar WHERE id=$1', [
      req.params.id,
    ]);

    if (!rows[0]) {
      return res.status(404).send('Gambar tidak ditemukan.');
    }

    const articleId = rows[0].artikel_id;
    const imagePath = rows[0].gambar;

    // Hapus record DB
    await db.query('DELETE FROM artikel_gambar WHERE id=$1', [req.params.id]);

    // Hapus file dari Supabase atau local storage lama
    await removeStoredFile(imagePath);

    await db.query('UPDATE artikel SET updated_at=NOW() WHERE id=$1', [
      articleId,
    ]);

    res.redirect(`/admin/artikel/edit/${articleId}`);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT * FROM artikel_gambar
       WHERE artikel_id=$1
       ORDER BY id`,
      [req.params.id]
    );

    const article = await db.query('SELECT id FROM artikel WHERE id=$1', [
      req.params.id,
    ]);

    if (!article[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    // Hapus artikel dan gambar dari DB
    await db.query('DELETE FROM artikel WHERE id=$1', [req.params.id]);

    // Hapus semua file gambar
    for (const row of rows) {
      await removeStoredFile(row.gambar);
    }

    res.redirect('/admin/artikel');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  index,
  showCreate,
  create,
  detail,
  showEdit,
  update,
  deleteImage,
  remove,
};

/*
const fs = require('fs');
const path = require('path');
const db = require('../../config/db');

const uploadRoot = path.resolve(__dirname, '../../public/uploads');

function safeFilePath(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(__dirname, '../../public', filePath.replace(/^\/+/, ''));
  return absolute.startsWith(uploadRoot + path.sep) ? absolute : null;
}

function removeFile(filePath) {
  const full = safeFilePath(filePath);
  if (!full) return;
  try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch (err) { console.error('Gagal menghapus file:', err); }
}

function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 240) || 'artikel';
}

async function uniqueSlug(slug, excludeId = null) {
  const base = slugify(slug);
  let candidate = base;
  let n = 2;
  while (true) {
    const params = [candidate];
    let sql = 'SELECT id FROM artikel WHERE slug = $1';
    if (excludeId) { sql += ' AND id <> $2'; params.push(excludeId); }
    const rows = await db.query(sql, params);
    if (!rows[0]) return candidate;
    candidate = `${base}-${n++}`.slice(0, 250);
  }
}

async function index(req, res, next) {
  try { const articles = await db.query('SELECT * FROM artikel ORDER BY statuspin DESC, created_at DESC'); res.render('admin/artikel/index', { articles }); }
  catch (err) { next(err); }
}

function showCreate(req, res) { res.render('admin/artikel/tambah', { article: null, images: [], error: null }); }

async function create(req, res, next) {
  const files = req.files || [];
  const client = await db.pool.connect();
  try {
    const judul = String(req.body.judul || '').trim();
    if (!judul) throw new Error('Judul artikel wajib diisi.');
    const slug = await uniqueSlug(String(req.body.slug || judul).trim());
    const isi = req.body.isi || '';
    const status = req.body.status === '1' ? '1' : '0';
    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    await client.query('BEGIN');
    const inserted = await client.query('INSERT INTO artikel (judul, slug, isi, status, statuspin, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING id', [judul, slug, isi, status, statuspin]);
    const articleId = inserted.rows[0].id;

    for (let i = 0; i < files.length; i++) {
      const dbPath = `/uploads/artikel/${files[i].filename}`;
      await client.query('INSERT INTO artikel_gambar (artikel_id, gambar, urutan, created_at) VALUES ($1,$2,$3,NOW())', [articleId, dbPath, i + 1]);
    }
    await client.query('COMMIT');
    res.redirect(`/admin/artikel/detail/${articleId}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    files.forEach(f => removeFile(`/uploads/artikel/${f.filename}`));
    if (err.message && !err.code) return res.status(400).render('admin/artikel/tambah', { article: req.body, images: [], error: err.message });
    next(err);
  } finally { client.release(); }
}

async function detail(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).render('error', { status: 404, message: 'Artikel tidak ditemukan.' });
    const images = await db.query('SELECT * FROM artikel_gambar WHERE artikel_id = $1 ORDER BY urutan ASC, id ASC', [req.params.id]);
    res.render('admin/artikel/detail', { article: rows[0], images });
  } catch (err) { next(err); }
}

async function showEdit(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).render('error', { status: 404, message: 'Artikel tidak ditemukan.' });
    const images = await db.query('SELECT * FROM artikel_gambar WHERE artikel_id = $1 ORDER BY urutan ASC, id ASC', [req.params.id]);
    res.render('admin/artikel/edit', { article: rows[0], images, error: null });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  const files = req.files || [];
  const client = await db.pool.connect();
  try {
    const id = Number(req.params.id);
    const existing = await client.query('SELECT * FROM artikel WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      files.forEach(f => removeFile(`/uploads/artikel/${f.filename}`));
      return res.status(404).render('error', { status: 404, message: 'Artikel tidak ditemukan.' });
    }
    const judul = String(req.body.judul || '').trim();
    if (!judul) throw new Error('Judul artikel wajib diisi.');
    const slug = await uniqueSlug(String(req.body.slug || judul).trim(), id);
    const status = req.body.status === '1' ? '1' : '0';
    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    await client.query('BEGIN');
    await client.query('UPDATE artikel SET judul=$1, slug=$2, isi=$3, status=$4, statuspin=$5, updated_at=NOW() WHERE id=$6', [judul, slug, req.body.isi || '', status, statuspin, id]);

    const ids = Array.isArray(req.body.image_ids) ? req.body.image_ids : (req.body.image_ids ? [req.body.image_ids] : []);
    const orders = Array.isArray(req.body.image_orders) ? req.body.image_orders : (req.body.image_orders ? [req.body.image_orders] : []);
    for (let i = 0; i < ids.length; i++) {
      const imageId = Number(ids[i]);
      const order = Number(orders[i]) || i + 1;
      if (Number.isInteger(imageId)) await client.query('UPDATE artikel_gambar SET urutan=$1 WHERE id=$2 AND artikel_id=$3', [order, imageId, id]);
    }
    const count = await client.query('SELECT COALESCE(MAX(urutan),0) AS max_order FROM artikel_gambar WHERE artikel_id=$1', [id]);
    let nextOrder = Number(count.rows[0].max_order) + 1;
    for (const file of files) {
      await client.query('INSERT INTO artikel_gambar (artikel_id, gambar, urutan, created_at) VALUES ($1,$2,$3,NOW())', [id, `/uploads/artikel/${file.filename}`, nextOrder++]);
    }
    await client.query('COMMIT');
    res.redirect(`/admin/artikel/edit/${id}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    files.forEach(f => removeFile(`/uploads/artikel/${f.filename}`));
    if (err.message && !err.code) {
      const images = await db.query('SELECT * FROM artikel_gambar WHERE artikel_id=$1 ORDER BY urutan,id', [req.params.id]);
      return res.status(400).render('admin/artikel/edit', { article: { ...req.body, id: req.params.id }, images, error: err.message });
    }
    next(err);
  } finally { client.release(); }
}

async function deleteImage(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel_gambar WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).send('Gambar tidak ditemukan.');
    const articleId = rows[0].artikel_id;
    await db.query('DELETE FROM artikel_gambar WHERE id=$1', [req.params.id]);
    removeFile(rows[0].gambar);
    await db.query('UPDATE artikel SET updated_at=NOW() WHERE id=$1', [articleId]);
    res.redirect(`/admin/artikel/edit/${articleId}`);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const rows = await db.query('SELECT * FROM artikel_gambar WHERE artikel_id=$1 ORDER BY id', [req.params.id]);
    const article = await db.query('SELECT id FROM artikel WHERE id=$1', [req.params.id]);
    if (!article[0]) return res.status(404).render('error', { status: 404, message: 'Artikel tidak ditemukan.' });
    await db.query('DELETE FROM artikel WHERE id=$1', [req.params.id]);
    rows.forEach(row => removeFile(row.gambar));
    res.redirect('/admin/artikel');
  } catch (err) { next(err); }
}

module.exports = { index, showCreate, create, detail, showEdit, update, deleteImage, remove };
*/
