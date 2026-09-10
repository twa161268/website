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

    const status = req.body.status === '1' ? '1' : '0';

    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    // =====================================================
    // BACA DATA CONTENT BLOCK
    // =====================================================

    let contentBlocks = [];

    if (req.body.content_data) {
      try {
        contentBlocks = JSON.parse(req.body.content_data);
      } catch (err) {
        throw new Error('Format isi artikel tidak valid.');
      }
    }

    // =====================================================
    // VALIDASI CONTENT BLOCK
    // =====================================================

    if (!Array.isArray(contentBlocks)) {
      throw new Error('Data isi artikel tidak valid.');
    }

    const allowedTypes = ['TEKS', 'GAMBAR', 'VIDEO'];

    for (const block of contentBlocks) {
      if (!allowedTypes.includes(block.tipe)) {
        throw new Error(`Tipe content tidak valid: ${block.tipe}`);
      }

      if (block.tipe === 'TEKS' && !String(block.isi || '').trim()) {
        throw new Error('Blok teks tidak boleh kosong.');
      }
    }

    // =====================================================
    // UPLOAD SEMUA MEDIA KE SUPABASE
    // =====================================================

    for (const file of files) {
      const uploaded = await uploadToSupabase(file);

      uploadedFiles.push(uploaded);
    }

    // =====================================================
    // MULAI TRANSAKSI DATABASE
    // =====================================================

    await client.query('BEGIN');

    // =====================================================
    // INSERT ARTIKEL
    // =====================================================

    const inserted = await client.query(
      `INSERT INTO artikel
       (
         judul,
         slug,
         isi,
         status,
         statuspin,
         created_at,
         updated_at
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         $5,
         NOW(),
         NOW()
       )
       RETURNING id`,
      [judul, slug, '', status, statuspin]
    );

    const articleId = inserted.rows[0].id;

    // =====================================================
    // INSERT CONTENT
    // =====================================================

    let fileIndex = 0;
    let urutan = 1;

    for (const block of contentBlocks) {
      // ---------------------------------------------------
      // TEKS
      // ---------------------------------------------------

      if (block.tipe === 'TEKS') {
        await client.query(
          `INSERT INTO artikel_konten
           (
             artikel_id,
             tipe,
             isi,
             media_url,
             urutan,
             created_at
           )
           VALUES
           (
             $1,
             'TEKS',
             $2,
             NULL,
             $3,
             NOW()
           )`,
          [articleId, block.isi || '', urutan]
        );
      }

      // ---------------------------------------------------
      // GAMBAR / VIDEO
      // ---------------------------------------------------
      else if (block.tipe === 'GAMBAR' || block.tipe === 'VIDEO') {
        const uploaded = uploadedFiles[fileIndex];

        if (!uploaded) {
          throw new Error(`File untuk blok ${block.tipe} tidak ditemukan.`);
        }

        // Pastikan tipe file sesuai
        if (
          block.tipe === 'GAMBAR' &&
          !uploaded.storagePath.match(/\.(jpg|jpeg|png)$/i)
        ) {
          throw new Error('File pada blok GAMBAR bukan file gambar.');
        }

        if (
          block.tipe === 'VIDEO' &&
          !uploaded.storagePath.match(/\.(mp4|webm|ogg)$/i)
        ) {
          throw new Error('File pada blok VIDEO bukan file video.');
        }

        await client.query(
          `INSERT INTO artikel_konten
           (
             artikel_id,
             tipe,
             isi,
             media_url,
             urutan,
             created_at
           )
           VALUES
           (
             $1,
             $2,
             NULL,
             $3,
             $4,
             NOW()
           )`,
          [articleId, block.tipe, uploaded.publicUrl, urutan]
        );

        fileIndex++;
      }

      urutan++;
    }

    // =====================================================
    // COMMIT
    // =====================================================

    await client.query('COMMIT');

    res.redirect(`/admin/artikel/detail/${articleId}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // Hapus file Supabase jika database gagal
    for (const uploaded of uploadedFiles) {
      await removeSupabaseFile(uploaded.publicUrl);
    }

    if (err.message && !err.code) {
      return res.status(400).render('admin/artikel/tambah', {
        article: req.body,
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

    const contents = await db.query(
      `SELECT *
   FROM artikel_konten
   WHERE artikel_id = $1
   ORDER BY urutan ASC, id ASC`,
      [req.params.id]
    );

    res.render('admin/artikel/detail', {
      article: rows[0],
      contents,
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


    const contents = await db.query(
      `SELECT *
       FROM artikel_konten
       WHERE artikel_id = $1
       ORDER BY urutan ASC, id ASC`,
      [req.params.id]
    );

    res.render('admin/artikel/edit', {
      article: rows[0],
      contents,
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

    if (!Number.isInteger(id)) {
      throw new Error('ID artikel tidak valid.');
    }

    // =====================================================
    // CEK ARTIKEL
    // =====================================================

    const existing = await client.query('SELECT * FROM artikel WHERE id = $1', [
      id,
    ]);

    if (!existing.rows[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    // =====================================================
    // SIMPAN CONTENT LAMA
    // Untuk cleanup file Supabase setelah update berhasil
    // =====================================================

    const oldContentsResult = await client.query(
      `SELECT *
       FROM artikel_konten
       WHERE artikel_id = $1
       ORDER BY urutan ASC, id ASC`,
      [id]
    );

    const oldMediaUrls = oldContentsResult.rows
      .filter((row) => row.media_url)
      .map((row) => row.media_url);

    // =====================================================
    // DATA ARTIKEL
    // =====================================================

    const judul = String(req.body.judul || '').trim();

    if (!judul) {
      throw new Error('Judul artikel wajib diisi.');
    }

    const slug = await uniqueSlug(String(req.body.slug || judul).trim(), id);

    const status = req.body.status === '1' ? '1' : '0';
    const statuspin = req.body.statuspin === '1' ? '1' : '0';

    // =====================================================
    // PARSE CONTENT DATA
    // =====================================================

    let contents = [];

    try {
      contents = JSON.parse(req.body.content_data || '[]');
    } catch (err) {
      throw new Error('Data isi artikel tidak valid.');
    }

    if (!Array.isArray(contents)) {
      throw new Error('Format isi artikel tidak valid.');
    }

    // =====================================================
    // VALIDASI BLOCK
    // =====================================================

    const allowedTypes = ['TEKS', 'GAMBAR', 'VIDEO'];

    for (const content of contents) {
      if (!allowedTypes.includes(content.tipe)) {
        throw new Error(`Tipe content tidak valid: ${content.tipe}`);
      }

      if (content.tipe === 'TEKS' && !String(content.isi || '').trim()) {
        throw new Error('Block teks tidak boleh kosong.');
      }

      if (content.tipe === 'GAMBAR' || content.tipe === 'VIDEO') {
        if (!content.media_field && !content.media_url) {
          throw new Error(
            `Block ${content.tipe} pada urutan ${
              content.urutan || '?'
            } tidak memiliki file.`
          );
        }
      }
    }

    // =====================================================
    // BUAT MAP FILE BERDASARKAN FIELD NAME
    //
    // Contoh:
    // content_media_25
    // content_media_26
    // content_media_new_mf8x2_ab1234
    // =====================================================

    const fileMap = new Map();

    for (const file of files) {
      if (!file.fieldname) {
        throw new Error('Nama field file upload tidak ditemukan.');
      }

      if (fileMap.has(file.fieldname)) {
        throw new Error(`File upload ganda untuk field ${file.fieldname}.`);
      }

      // Validasi MIME
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'video/mp4',
        'video/webm',
        'video/ogg',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(
          'File tidak didukung. Hanya JPG, JPEG, PNG, MP4, WEBM, dan OGG.'
        );
      }

      fileMap.set(file.fieldname, file);
    }

    // =====================================================
    // UPLOAD MEDIA SESUAI BLOCK
    // =====================================================

    const usedFileFields = new Set();

    for (const content of contents) {
      if (content.tipe !== 'GAMBAR' && content.tipe !== 'VIDEO') {
        continue;
      }

      const mediaField = String(content.media_field || '').trim();

      const file = mediaField ? fileMap.get(mediaField) : null;

      // ---------------------------------------------------
      // ADA FILE BARU
      // ---------------------------------------------------

      if (file) {
        // Pastikan extension sesuai tipe block
        const ext = path.extname(file.originalname).toLowerCase();

        if (
          content.tipe === 'GAMBAR' &&
          !['.jpg', '.jpeg', '.png'].includes(ext)
        ) {
          throw new Error(
            `File pada block GAMBAR urutan ${
              content.urutan || '?'
            } harus JPG, JPEG, atau PNG.`
          );
        }

        if (
          content.tipe === 'VIDEO' &&
          !['.mp4', '.webm', '.ogg'].includes(ext)
        ) {
          throw new Error(
            `File pada block VIDEO urutan ${
              content.urutan || '?'
            } harus MP4, WEBM, atau OGG.`
          );
        }

        const uploaded = await uploadToSupabase(file);

        uploadedFiles.push(uploaded);

        // Ganti URL media block dengan file baru
        content.media_url = uploaded.publicUrl;

        usedFileFields.add(mediaField);
      }

      // ---------------------------------------------------
      // TIDAK ADA FILE BARU
      // Gunakan URL lama
      // ---------------------------------------------------
      else if (content.media_url) {
        // tetap gunakan URL lama
      }

      // ---------------------------------------------------
      // MEDIA TIDAK ADA
      // ---------------------------------------------------
      else {
        throw new Error(
          `Block ${content.tipe} pada urutan ${
            content.urutan || '?'
          } tidak memiliki file.`
        );
      }
    }

    // =====================================================
    // PASTIKAN TIDAK ADA FILE UPLOAD YANG TIDAK TERPAKAI
    // =====================================================

    for (const file of files) {
      if (!usedFileFields.has(file.fieldname)) {
        throw new Error(
          `File upload "${file.originalname}" tidak terkait dengan block artikel.`
        );
      }
    }

    // =====================================================
    // MULAI TRANSAKSI DATABASE
    // =====================================================

    await client.query('BEGIN');

    // =====================================================
    // UPDATE HEADER ARTIKEL
    // =====================================================

    await client.query(
      `UPDATE artikel
       SET judul = $1,
           slug = $2,
           isi = $3,
           status = $4,
           statuspin = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [judul, slug, '', status, statuspin, id]
    );

    // =====================================================
    // HAPUS CONTENT LAMA
    // =====================================================

    await client.query(
      `DELETE FROM artikel_konten
       WHERE artikel_id = $1`,
      [id]
    );

    // =====================================================
    // INSERT CONTENT SESUAI URUTAN BLOCK
    // =====================================================

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];

      let isi = null;
      let mediaUrl = null;

      // ---------------------------------------------------
      // TEKS
      // ---------------------------------------------------

      if (content.tipe === 'TEKS') {
        isi = String(content.isi || '');
      }

      // ---------------------------------------------------
      // GAMBAR / VIDEO
      // ---------------------------------------------------
      else {
        mediaUrl = content.media_url;
      }

      // ---------------------------------------------------
      // INSERT artikel_konten
      // ---------------------------------------------------

      await client.query(
        `INSERT INTO artikel_konten
         (
           artikel_id,
           tipe,
           isi,
           media_url,
           urutan,
           created_at
         )
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        [id, content.tipe, isi, mediaUrl, i + 1]
      );

    }

    // =====================================================
    // COMMIT
    // =====================================================

    await client.query('COMMIT');

    // =====================================================
    // CLEANUP FILE LAMA
    //
    // Hanya hapus file lama yang sudah tidak dipakai.
    // =====================================================

    const newMediaUrls = contents
      .filter(
        (content) => content.tipe === 'GAMBAR' || content.tipe === 'VIDEO'
      )
      .map((content) => content.media_url)
      .filter(Boolean);

    const oldUrls = oldMediaUrls;

    const uniqueOldUrls = [...new Set(oldUrls)];

    const uniqueNewUrls = new Set(newMediaUrls);

    for (const oldUrl of uniqueOldUrls) {
      if (!uniqueNewUrls.has(oldUrl)) {
        await removeStoredFile(oldUrl);
      }
    }

    // =====================================================
    // SELESAI
    // =====================================================

    res.redirect(`/admin/artikel/detail/${id}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});

    // =====================================================
    // HAPUS FILE BARU JIKA TRANSAKSI GAGAL
    // =====================================================

    for (const uploaded of uploadedFiles) {
      await removeSupabaseFile(uploaded.publicUrl);
    }

    // =====================================================
    // TAMPILKAN ERROR
    // =====================================================

    if (err.message && !err.code) {
      const contents = await db.query(
        `SELECT *
         FROM artikel_konten
         WHERE artikel_id = $1
         ORDER BY urutan ASC, id ASC`,
        [req.params.id]
      );

      return res.status(400).render('admin/artikel/edit', {
        article: {
          ...req.body,
          id: req.params.id,
        },
        contents,
        error: err.message,
      });
    }

    next(err);
  } finally {
    client.release();
  }
}

async function remove(req, res, next) {
  try {
    const articleId = Number(req.params.id);

    if (!Number.isInteger(articleId)) {
      return res.status(400).render('error', {
        status: 400,
        message: 'ID artikel tidak valid.',
      });
    }

    const article = await db.query(
      'SELECT id FROM artikel WHERE id = $1',
      [articleId]
    );

    if (!article[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    // Ambil semua media langsung dari artikel_konten.
    // Ini adalah satu-satunya sumber media artikel.
    const contents = await db.query(
      `SELECT media_url
       FROM artikel_konten
       WHERE artikel_id = $1
         AND media_url IS NOT NULL
         AND TRIM(media_url) <> ''`,
      [articleId]
    );

    const mediaUrls = [
      ...new Set(contents.map((row) => row.media_url).filter(Boolean)),
    ];

    // artikel_konten akan ikut terhapus karena ON DELETE CASCADE.
    await db.query('DELETE FROM artikel WHERE id = $1', [articleId]);

    // Hapus file media dari Supabase setelah record DB berhasil dihapus.
    for (const mediaUrl of mediaUrls) {
      await removeStoredFile(mediaUrl);
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
  remove,
};
