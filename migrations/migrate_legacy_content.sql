-- Migrasi data lama dari tabel tulisan/gambar ke artikel/artikel_konten.
-- Jalankan SATU KALI setelah backup database.
-- Tidak menghapus atau mengubah data lama di tabel tulisan dan gambar.

BEGIN;

WITH legacy_source AS (
  -- ABOUT lama: judul ABOUT, ABOUT2, ABOUT3, dst. dari tabel tulisan.
  SELECT 'about'::varchar(20) AS kategori, t.judul,
         t.status, t.created_at
  FROM public.tulisan t
  WHERE t.judul ~ '^ABOUT[0-9]*$'

  UNION ALL

  -- ABOUT lama: gambar kategori ABOUT.
  SELECT 'about'::varchar(20), g.judul, g.status, g.created_at
  FROM public.gambar g
  WHERE UPPER(COALESCE(g.kategori,'')) = 'ABOUT'
    AND g.judul ~ '^ABOUT[0-9]*$'

  UNION ALL

  -- Produk lama dari tabel gambar.
  SELECT 'produk'::varchar(20), g.judul, g.status, g.created_at
  FROM public.gambar g
  WHERE UPPER(COALESCE(g.kategori,'')) = 'PRODUK'

  UNION ALL

  -- Form lama dari tabel gambar.
  SELECT 'form'::varchar(20), g.judul, g.status, g.created_at
  FROM public.gambar g
  WHERE UPPER(COALESCE(g.kategori,'')) = 'FORM'
), legacy AS (
  SELECT kategori, judul,
         CASE WHEN BOOL_OR(status = '1') THEN '1' ELSE '0' END AS status,
         MAX(created_at) AS created_at
  FROM legacy_source
  WHERE NULLIF(BTRIM(judul), '') IS NOT NULL
  GROUP BY kategori, judul
), inserted AS (
  INSERT INTO public.artikel
    (judul, slug, isi, status, statuspin, kategori, created_at, updated_at)
  SELECT l.judul,
         LEFT('migrasi-' || l.kategori || '-' || MD5(l.kategori || '|' || LOWER(l.judul)), 250),
         '', l.status, '0', l.kategori,
         COALESCE(l.created_at, NOW()), NOW()
  FROM legacy l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.artikel a
    WHERE LOWER(a.judul) = LOWER(l.judul)
      AND LOWER(COALESCE(a.kategori,'artikel')) = l.kategori
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, judul, kategori
), block_rows AS (
  -- Blok gambar ABOUT ditaruh lebih dahulu agar mendekati tampilan ABOUT lama.
  SELECT i.id AS artikel_id, 'GAMBAR'::varchar(10) AS tipe,
         NULL::text AS isi, g.gambar::text AS media_url,
         ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY g.created_at NULLS LAST, g.id) AS sort_order
  FROM inserted i
  JOIN public.gambar g ON g.judul = i.judul
  WHERE i.kategori = 'about'
    AND UPPER(COALESCE(g.kategori,'')) = 'ABOUT'
    AND NULLIF(BTRIM(g.gambar), '') IS NOT NULL

  UNION ALL

  SELECT i.id, 'TEKS'::varchar(10), t.isi::text, NULL::text,
         1000000::bigint
  FROM inserted i
  JOIN public.tulisan t ON t.judul = i.judul
  WHERE i.kategori = 'about'
    AND NULLIF(BTRIM(t.isi), '') IS NOT NULL

  UNION ALL

  -- Produk dan Form: teks (jika ada pasangan judul di tulisan) lalu media.
  SELECT i.id, 'TEKS'::varchar(10), t.isi::text, NULL::text, 1::bigint
  FROM inserted i
  JOIN public.tulisan t ON t.judul = i.judul
  WHERE i.kategori IN ('produk','form')
    AND NULLIF(BTRIM(t.isi), '') IS NOT NULL

  UNION ALL

  SELECT i.id, 'GAMBAR'::varchar(10), NULL::text, g.gambar::text,
         100 + ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY g.created_at NULLS LAST, g.id)
  FROM inserted i
  JOIN public.gambar g ON g.judul = i.judul
  WHERE i.kategori IN ('produk','form')
    AND UPPER(COALESCE(g.kategori,'')) = UPPER(i.kategori)
    AND NULLIF(BTRIM(g.gambar), '') IS NOT NULL
)
INSERT INTO public.artikel_konten
  (artikel_id, tipe, isi, media_url, urutan, created_at)
SELECT artikel_id, tipe, isi, media_url,
       ROW_NUMBER() OVER (PARTITION BY artikel_id ORDER BY sort_order, COALESCE(media_url,'')),
       NOW()
FROM block_rows;

COMMIT;

-- Pemeriksaan hasil migrasi:
-- SELECT kategori, COUNT(*) FROM public.artikel GROUP BY kategori ORDER BY kategori;
-- SELECT a.id, a.judul, a.kategori, COUNT(ak.id) AS jumlah_blok
-- FROM public.artikel a LEFT JOIN public.artikel_konten ak ON ak.artikel_id = a.id
-- WHERE a.kategori IN ('about','produk','form')
-- GROUP BY a.id ORDER BY a.kategori, a.created_at DESC;
