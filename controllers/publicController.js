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
    const [backgrounds, banners, title, subtitle, articles, sosmed, footer] =
      await Promise.all([
        db.query(`
        SELECT *
        FROM gambar
        WHERE kategori = 'BACK'
          AND status = '1'
        ORDER BY statuspin DESC, created_at DESC
      `),

        db.query(`
      SELECT
        g.*,
        CASE
          WHEN a.status = '1' THEN a.slug
          ELSE NULL
        END AS artikel_slug,
        CASE
          WHEN a.status = '1' THEN a.judul
          ELSE NULL
        END AS artikel_judul
      FROM gambar g
      LEFT JOIN artikel a ON a.id = g.artikel_id
      WHERE g.kategori = 'BANNER'
        AND g.status = '1'
        AND g.judul IN ('BANNER1', 'BANNER2', 'BANNER3', 'BANNER4')
      ORDER BY
        CASE g.judul
          WHEN 'BANNER1' THEN 1
          WHEN 'BANNER2' THEN 2
          WHEN 'BANNER3' THEN 3
          WHEN 'BANNER4' THEN 4
          ELSE 99
        END
      `),

        getTulisanByJudul('TITLE'),

        getTulisanByJudul('SUBTITLE'),

        db.query(`
        SELECT
          a.*,
          (
            SELECT ak.media_url
            FROM artikel_konten ak
            WHERE ak.artikel_id = a.id
              AND ak.tipe = 'GAMBAR'
              AND ak.media_url IS NOT NULL
            ORDER BY ak.urutan ASC, ak.id ASC
            LIMIT 1
          ) AS thumbnail,
          (
            SELECT ak.isi
            FROM artikel_konten ak
            WHERE ak.artikel_id = a.id
              AND ak.tipe = 'TEKS'
              AND ak.isi IS NOT NULL
              AND TRIM(ak.isi) <> ''
            ORDER BY ak.urutan ASC, ak.id ASC
            LIMIT 1
          ) AS overview
        FROM artikel a
        WHERE a.status = '1'
        ORDER BY a.statuspin DESC, a.created_at DESC
        LIMIT 3
      `),

        getSosmed(),

        getFooter(),
      ]);

    //res.render('public/home', {
    //  background: backgrounds[0] || null,
    //  banners: banners || [],
    //  title,
    //  subtitle,
    //  articles: articles || [],
    //  sosmed: sosmed || [],
    //  footer,
    //});

    res.render('public/home', {
      backgroundWide:
        backgrounds.find((item) => item.slug === 'background-wide') || null,

      backgroundSquare:
        backgrounds.find((item) => item.slug === 'background-square') || null,

      backgroundMobile:
        backgrounds.find((item) => item.slug === 'background-mobile') || null,

      banners: banners || [],
      title,
      subtitle,
      articles: articles || [],
      sosmed: sosmed || [],
      footer,
    });
  } catch (err) {
    next(err);
  }
}

/*
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
*/

async function about(req, res, next) {
  try {
    const [texts, images, footer] = await Promise.all([
      db.query(`
        SELECT judul, isi
        FROM tulisan
        WHERE status = '1'
          AND judul ~ '^ABOUT[0-9]*$'
      `),

      db.query(`
        SELECT judul, gambar
        FROM gambar
        WHERE kategori = 'ABOUT'
          AND status = '1'
          AND judul ~ '^ABOUT[0-9]*$'
      `),

      getFooter(),
    ]);

    // Buat map berdasarkan judul
    const textMap = Object.fromEntries(texts.map((row) => [row.judul, row]));

    const imageMap = Object.fromEntries(images.map((row) => [row.judul, row]));

    // Gabungkan semua judul dari tulisan + gambar
    const judulSet = new Set([
      ...texts.map((row) => row.judul),
      ...images.map((row) => row.judul),
    ]);

    // ABOUT = 1, ABOUT2 = 2, ABOUT3 = 3, dst.
    const sections = [...judulSet]
      .sort((a, b) => {
        const nomorA = a === 'ABOUT' ? 1 : parseInt(a.replace('ABOUT', ''), 10);
        const nomorB = b === 'ABOUT' ? 1 : parseInt(b.replace('ABOUT', ''), 10);

        return nomorA - nomorB;
      })
      .map((judul) => ({
        judul,
        content: textMap[judul] || null,
        image: imageMap[judul] || null,
      }));

    res.render('public/about', {
      sections,
      footer,
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
      `
      SELECT
        a.*,

        -- Ambil gambar pertama sebagai thumbnail
        (
          SELECT ak.media_url
          FROM artikel_konten ak
          WHERE ak.artikel_id = a.id
            AND ak.tipe = 'GAMBAR'
            AND ak.media_url IS NOT NULL
          ORDER BY ak.urutan ASC, ak.id ASC
          LIMIT 1
        ) AS thumbnail,

        -- Ambil block TEKS pertama sebagai overview
        (
          SELECT ak.isi
          FROM artikel_konten ak
          WHERE ak.artikel_id = a.id
            AND ak.tipe = 'TEKS'
            AND ak.isi IS NOT NULL
            AND TRIM(ak.isi) <> ''
          ORDER BY ak.urutan ASC, ak.id ASC
          LIMIT 1
        ) AS overview

      FROM artikel a

      WHERE a.status = '1'

      ORDER BY
        a.statuspin DESC,
        a.created_at DESC
      `
    );

    res.render('public/artikel', {
      articles,
      footer: await getFooter(),
    });
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

    if (!articles[0]) {
      return res.status(404).render('error', {
        status: 404,
        message: 'Artikel tidak ditemukan.',
      });
    }

    const article = articles[0];

    // =====================================================
    // AMBIL CONTENT BLOCK
    // =====================================================

    const contents = await db.query(
      `SELECT *
       FROM artikel_konten
       WHERE artikel_id = $1
       ORDER BY urutan ASC, id ASC`,
      [article.id]
    );

    // =====================================================
    // RENDER
    // =====================================================

    res.render('public/detailArtikel', {
      article,
      contents,
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
