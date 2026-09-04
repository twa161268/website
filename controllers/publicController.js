const db = require('../config/db');

async function getSosmed() {
  const logos = await db.query(`
    SELECT judul, gambar
    FROM gambar
    WHERE kategori = 'SOSMED'
      AND status = '1'
    ORDER BY
      CASE judul
        WHEN 'INSTAGRAM' THEN 1
        WHEN 'FACEBOOK' THEN 2
        WHEN 'WHATSAPP' THEN 3
        ELSE 99
      END
  `);

  const texts = await db.query(`
    SELECT judul, isi
    FROM tulisan
    WHERE judul IN ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP')
      AND status = '1'
  `);

  const textMap = Object.fromEntries(
    texts.map((row) => [row.judul, row.isi || ''])
  );

  return logos.map((row) => ({
    judul: row.judul,
    gambar: row.gambar,
    isi: textMap[row.judul] || '',
  }));
}

async function getTulisanByJudul(judul) {
  const rows = await db.query(
    "SELECT * FROM tulisan WHERE judul = $1 AND status = '1' LIMIT 1",
    [judul]
  );
  return rows[0] || null;
}

//async function getFooter() {
//  const rows = await db.query(
//    "SELECT judul, isi FROM tulisan WHERE judul IN ('INSTAGRAM','FACEBOOK','WHATSAPP') AND status = '1'"
//  );
//  return Object.fromEntries(rows.map((r) => [r.judul, r.isi || '']));
//}

async function getFooter() {
  const rows = await db.query(`
    SELECT judul, isi
    FROM tulisan
    WHERE judul IN ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP')
      AND status = '1'
  `);

  const links = Object.fromEntries(rows.map((r) => [r.judul, r.isi || '']));

  const sosmed = await getSosmed();

  return {
    ...links,
    sosmed,
  };
}

async function home(req, res, next) {
  try {
    const [backgrounds, title, subtitle, articles, sosmed, footer] =
      await Promise.all([
        db.query(`
        SELECT *
        FROM gambar
        WHERE kategori = 'BACK'
          AND status = '1'
        ORDER BY statuspin DESC, created_at DESC
      `),

        getTulisanByJudul('TITLE'),

        getTulisanByJudul('SUBTITLE'),

        db.query(`
        SELECT a.*,
          (
            SELECT ag.gambar
            FROM artikel_gambar ag
            WHERE ag.artikel_id = a.id
            ORDER BY ag.urutan ASC, ag.id ASC
            LIMIT 1
          ) AS thumbnail
        FROM artikel a
        WHERE a.status = '1'
        ORDER BY a.statuspin DESC, a.created_at DESC
        LIMIT 3
      `),

        getSosmed(),

        getFooter(),
      ]);

    res.render('public/home', {
      background: backgrounds[0] || null,
      title,
      subtitle,
      articles,
      sosmed,
      footer,
    });
  } catch (err) {
    next(err);
  }
}

async function about(req, res, next) {
  try {
    res.render('public/about', {
      content: await getTulisanByJudul('ABOUT'),
      footer: await getFooter(),
    });
  } catch (err) {
    next(err);
  }
}

async function product(req, res, next) {
  try {
    const items = await db.query(
      "SELECT * FROM gambar WHERE kategori = 'PRODUK' AND status = '1' ORDER BY created_at DESC"
    );

    res.render('public/product', { items, footer: await getFooter() });
  } catch (err) {
    next(err);
  }
}

async function form(req, res, next) {
  try {
    const items = await db.query(
      "SELECT * FROM gambar WHERE kategori = 'FORM' AND status = '1' ORDER BY created_at DESC"
    );
    res.render('public/form', { items, footer: await getFooter() });
  } catch (err) {
    next(err);
  }
}

async function gallery(req, res, next) {
  try {
    const items = await db.query(
      "SELECT * FROM gambar WHERE kategori = 'GALLERY' AND status = '1' ORDER BY created_at DESC"
    );

    res.render('public/gallery', { items, footer: await getFooter() });
  } catch (err) {
    next(err);
  }
}

async function artikel(req, res, next) {
  try {
    const articles = await db.query(
      "SELECT a.*, (SELECT ag.gambar FROM artikel_gambar ag WHERE ag.artikel_id = a.id ORDER BY ag.urutan ASC, ag.id ASC LIMIT 1) AS thumbnail FROM artikel a WHERE a.status = '1' ORDER BY a.statuspin DESC, a.created_at DESC"
    );
    res.render('public/artikel', { articles, footer: await getFooter() });
  } catch (err) {
    next(err);
  }
}

async function detailArtikel(req, res, next) {
  try {
    const articles = await db.query(
      "SELECT * FROM artikel WHERE slug = $1 AND status = '1' LIMIT 1",
      [req.params.slug]
    );
    if (!articles[0])
      return res
        .status(404)
        .render('error', { status: 404, message: 'Artikel tidak ditemukan.' });
    const images = await db.query(
      'SELECT * FROM artikel_gambar WHERE artikel_id = $1 ORDER BY urutan ASC, id ASC',
      [articles[0].id]
    );

    // Ambil logo SOSMED dari tabel gambar
    // dan alamatnya dari tabel tulisan

    res.render('public/detailArtikel', {
      article: articles[0],
      images,
      footer: await getFooter(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  home,
  about,
  product,
  form,
  gallery,
  artikel,
  detailArtikel,
};
