# Update Website — Screen 1 & Screen 2

Berdasarkan source `web_app(1).zip` dan struktur tabel dalam `Database(1).txt`.

## File yang diubah
- `controllers/publicController.js` — homepage mengambil empat artikel, data ABOUT/ABOUT2 dari tabel `tulisan` dan `gambar`, serta tetap memakai data BACK/BANNER dan footer yang sudah ada.
- `views/public/home.ejs` — disusun ulang menjadi Screen 1 (hero + Banner 1–4) dan Screen 2 (About, Visi/Misi, Articles, footer).
- `views/partials/header.ejs` — menu About menuju bagian About pada homepage, dan tetap menuju `/about` di halaman lain.
- `views/partials/footer.ejs` — mendukung penempatan footer di dalam Screen 2 tanpa menutup dokumen terlalu awal; perilaku halaman lain tetap dipertahankan.
- `public/css/style.css` — menambahkan aturan layout Screen 1/2 dan responsive untuk desktop, tablet, serta mobile.

## Catatan
- Tidak ada perubahan skema database.
- Banner dipilih dari `gambar` dengan kategori `BANNER` dan judul `BANNER1` sampai `BANNER4`; gambar background memakai kategori `BACK` dan slug background yang telah dipakai aplikasi.
- Konten ABOUT diambil dari baris `tulisan` berjudul `ABOUT`, `ABOUT2`, dan seterusnya, serta gambar dari kategori `ABOUT` dengan judul yang sama.
- Visi dan Misi hanya berupa kerangka judul; kontennya belum diisi.
- More articles mengarah ke `/artikel`.
- File `.env`/kredensial tidak disertakan.

## Pemeriksaan yang dilakukan
- `node --check app.js`
- `node --check controllers/publicController.js`
- `node --check public/js/main.js`
- Pemeriksaan jumlah pembuka/penutup tag EJS dan kurung kurawal CSS.

Template EJS belum dapat diuji dengan compiler EJS dalam lingkungan ini karena paket `ejs` tidak tersedia di cache offline. Jalankan aplikasi lokal dan cek homepage di browser sebelum deploy.


## Revisi banner dan responsivitas (1 Oktober 2026)
- Jarak Banner 3 dan Banner 4 diperlebar dengan jarak responsif menggunakan `clamp()`; jarak berubah mengikuti ukuran viewport.
- Gambar/video Banner 3 dan 4 serta Banner 1 dan 2 memakai `object-fit: fill`, sehingga mengisi seluruh box. Rasio asli dapat berubah bila rasio gambar berbeda dengan box.
- Aturan tambahan untuk tablet, ponsel portrait/landscape, dan monitor dengan tinggi layar pendek.
- Tidak ada perubahan database atau controller pada revisi ini.

## Revisi tampilan ponsel — tinggi banner dan posisi teks
- Banner 1 dan 2 pada ponsel portrait dipendekkan menjadi sekitar 20vh (19vh untuk layar sangat kecil).
- Banner 3 dan 4 dibuat lebih pendek secara vertikal dan sedikit lebih lebar agar tidak terlalu cungkring.
- Title dan subtitle digeser lebih ke bawah pada area hero.
- Perubahan ini khusus ponsel portrait; ukuran desktop dan tablet tidak diubah oleh aturan baru ini.

## Revisi komposisi HP portrait berdasarkan sketsa
- Area hero/background dibuat tinggi (82vh), banner 3 dan 4 diposisikan lebih ke tengah-bawah dan dibatasi sekitar 27–28vh.
- Banner 1 dan 2 diletakkan di bawah hero, selebar layar, dengan tinggi pendek sekitar 9vh.
- Gambar/video Banner 1 dan 2 menggunakan `object-fit: contain` agar tidak gepeng/melar.
- Title dan subtitle diturunkan ke area tengah-bawah background.
