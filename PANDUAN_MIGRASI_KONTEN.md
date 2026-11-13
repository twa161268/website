# Perubahan Konten Website

## Perubahan aplikasi
- Menu admin Artikel diganti menjadi Konten Website.
- Satu modul mengelola kategori `artikel`, `about`, `produk`, dan `form`.
- Konten menggunakan tabel `artikel` dan `artikel_konten`.
- Menu Tulisan tetap ada untuk TITLE, SUBTITLE, dan teks umum; record ABOUT lama disembunyikan dari menu ini.
- Menu Gambar tetap ada untuk BACK, BANNER, GALLERY, dan SOSMED; data ABOUT/PRODUK/FORM lama disembunyikan dari menu ini.
- Konten publik yang aktif diurutkan berdasarkan PIN terlebih dahulu, kemudian `created_at` terbaru, lalu `id` terbaru.
- Halaman utama hanya menampilkan empat konten About teratas. Halaman About menampilkan semua konten About aktif.

## Migrasi data lama
1. Backup database Supabase terlebih dahulu.
2. Pastikan field `artikel.kategori` sudah tersedia dan berisi kategori `artikel` untuk data artikel lama.
3. Buka file `migrations/migrate_legacy_content.sql` di SQL Editor Supabase.
4. Jalankan satu kali. Script memindahkan data ABOUT lama dari `tulisan`/`gambar`, serta data PRODUK dan FORM lama dari `gambar`, ke `artikel`/`artikel_konten`.
5. Script tidak menghapus data dari tabel `tulisan` atau `gambar`.
6. Jalankan query pemeriksaan yang ada di bagian akhir script untuk melihat jumlah data hasil migrasi.

Jangan jalankan migrasi sebelum backup database.
