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

async function getCategoryContent(kategori, { activeOnly = true } = {}) {
  const rows = await db.query(
    `SELECT * FROM artikel
     WHERE kategori = $1 ${activeOnly ? "AND status = '1'" : ''}
     ORDER BY statuspin DESC, created_at DESC, id DESC`,
    [kategori]
  );
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const blocks = await db.query(
    `SELECT * FROM artikel_konten
     WHERE artikel_id = ANY($1::int[])
     ORDER BY artikel_id, urutan ASC, id ASC`,
    [ids]
  );
  const byArticle = new Map();
  for (const block of blocks) {
    if (!byArticle.has(block.artikel_id)) byArticle.set(block.artikel_id, []);
    byArticle.get(block.artikel_id).push(block);
  }
  return rows.map((row) => ({ ...row, contents: byArticle.get(row.id) || [] }));
}

async function home(req, res, next) {
  try {
    const [backgrounds, banners, title, subtitle, allArticles, aboutRecords, footer] = await Promise.all([
      db.query(`SELECT * FROM gambar WHERE kategori = 'BACK' AND status = '1' ORDER BY statuspin DESC, created_at DESC`),
      db.query(`
        SELECT g.*, CASE WHEN a.status = '1' AND COALESCE(a.kategori,'artikel') = 'artikel' THEN a.slug ELSE NULL END AS artikel_slug,
               CASE WHEN a.status = '1' AND COALESCE(a.kategori,'artikel') = 'artikel' THEN a.judul ELSE NULL END AS artikel_judul
        FROM gambar g LEFT JOIN artikel a ON a.id = g.artikel_id
        WHERE g.kategori = 'BANNER' AND g.status = '1'
          AND g.judul IN ('BANNER1','BANNER2','BANNER3','BANNER4')
        ORDER BY CASE g.judul WHEN 'BANNER1' THEN 1 WHEN 'BANNER2' THEN 2 WHEN 'BANNER3' THEN 3 WHEN 'BANNER4' THEN 4 ELSE 99 END
      `),
      getTulisanByJudul('TITLE'),
      getTulisanByJudul('SUBTITLE'),
      getCategoryContent('artikel'),
      getCategoryContent('about'),
      getFooter(),
    ]);
    const articles = allArticles.slice(0, 4).map((article) => ({
      ...article,
      thumbnail: article.contents.find((c) => c.tipe === 'GAMBAR')?.media_url || null,
      overview: article.contents.find((c) => c.tipe === 'TEKS')?.isi || '',
    }));
    // Homepage menampilkan seluruh konten kategori About yang memiliki blok teks.
    // Seluruh blok teks/gambar/video dipertahankan sesuai urutan artikel_konten.
    const aboutSections = aboutRecords
      .filter((article) => article.contents.some((block) =>
        block.tipe === 'TEKS' && String(block.isi || '').trim() !== ''
      ))
      .map((article) => ({
        ...article,
        image: article.contents.find((c) => c.tipe === 'GAMBAR') || null,
        content: article.contents.find((c) => c.tipe === 'TEKS') || null,
      }));
    res.render('public/home', {
      currentPage: 'home',
      backgroundWide: backgrounds.find((item) => item.slug === 'background-wide') || backgrounds[0] || null,
      backgroundSquare: backgrounds.find((item) => item.slug === 'background-square') || null,
      backgroundMobile: backgrounds.find((item) => item.slug === 'background-mobile') || null,
      banners: banners || [], title, subtitle, articles, aboutSections, footer,
    });
  } catch (err) { next(err); }
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
    const [sections, footer] = await Promise.all([getCategoryContent('about'), getFooter()]);
    res.render('public/about', { sections, footer });
  } catch (err) { next(err); }
}

async function product(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    let items = await getCategoryContent('produk');
    if (q) items = items.filter((item) => item.judul.toLowerCase().includes(q.toLowerCase()) || item.contents.some((c) => c.tipe === 'TEKS' && String(c.isi || '').toLowerCase().includes(q.toLowerCase())));
    res.render('public/product', { items, q, footer: await getFooter() });
  } catch (err) { next(err); }
}

/*
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
*/

async function form(req, res, next) {
  try {
    const items = await getCategoryContent('form');
    res.render('public/form', { items, footer: await getFooter() });
  } catch (err) { next(err); }
}

async function gallery(req, res, next) {
  try {
    const q = (req.query.q || '').trim();

    let sql = `
      SELECT *
      FROM gambar
      WHERE kategori = 'GALLERY'
        AND status = '1'
    `;

    const params = [];

    // Jika ada kata kunci pencarian
    if (q) {
      params.push(`%${q}%`);

      sql += `
        AND judul ILIKE $1
      `;
    }

    sql += `
      ORDER BY created_at DESC
    `;

    const items = await db.query(sql, params);

    res.render('public/gallery', {
      items,
      q,
      footer: await getFooter(),
    });
  } catch (err) {
    next(err);
  }
}

/*
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
*/


async function artikel(req, res, next) {
  try {
    const q = (req.query.q || '').trim();

    let sql = `
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
        AND COALESCE(a.kategori, 'artikel') = 'artikel'
    `;

    const params = [];

    // Jika ada kata kunci pencarian
    if (q) {
      params.push(`%${q}%`);

      sql += `
        AND (
          a.judul ILIKE $1
          OR EXISTS (
            SELECT 1
            FROM artikel_konten ak
            WHERE ak.artikel_id = a.id
              AND ak.tipe = 'TEKS'
              AND ak.isi ILIKE $1
          )
        )
      `;
    }

    sql += `
      ORDER BY
        a.statuspin DESC,
        a.created_at DESC,
        a.id DESC
    `;

    const articles = await db.query(sql, params);

    res.render('public/artikel', {
      articles,
      q,
      footer: await getFooter(),
    });
  } catch (err) {
    next(err);
  }
}

/*
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
*/

async function detailArtikel(req, res, next) {
  try {
    const articles = await db.query(
      "SELECT * FROM artikel WHERE slug = $1 AND status = '1' AND COALESCE(kategori, 'artikel') = 'artikel' LIMIT 1",
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
