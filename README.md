# HadirAlumni — Daftar Hadir Pengajian Alumni Maskana

Aplikasi absensi peserta berbasis QR untuk acara warga.

## Cara memakai

1. Buka `index.html` dengan Google Chrome atau Microsoft Edge.
2. Masuk ke menu **Data Peserta**, lalu klik **Tambah peserta**.
3. Isi nama, alamat (desa, kecamatan, kabupaten), dan nomor WhatsApp. Sistem akan membuat QR unik sekaligus mengisinya pada kartu digital bawaan aplikasi.
4. Cetak atau unduh kartu QR tersebut untuk setiap peserta.
5. Saat acara, buka menu **Scan Kehadiran**, klik kolom scan, lalu arahkan scanner USB ke QR peserta. Scanner yang berfungsi sebagai keyboard akan mengirim kode dan Enter secara otomatis.
6. Pantau jumlah kehadiran dan desa yang sudah hadir dari menu **Dasbor** atau **Rekap Desa**.

## Penyimpanan data

Versi ini menyimpan data di browser pada komputer yang digunakan (local storage). Gunakan komputer/browser yang sama saat pendaftaran dan scan, dan ekspor CSV secara berkala sebagai cadangan melalui tombol unduh di kanan atas.

Untuk dipakai oleh beberapa panitia atau beberapa perangkat sekaligus dengan data yang tersinkron real-time, aplikasi perlu dihubungkan ke database/server online.

## Pengiriman kartu dan alamat otomatis

- Tombol **Kirim kartu ke WhatsApp** menggunakan menu berbagi perangkat agar kartu PNG menjadi lampiran. Pilih WhatsApp lalu pilih kontak peserta. Pada browser desktop yang belum mendukung berbagi file, kartu akan diunduh untuk dilampirkan manual ke chat WhatsApp.
- Saat desa pernah disimpan sekali, aplikasi mengingat pasangan desa, kecamatan, dan kabupatennya. Saat desa yang sama diketik untuk peserta berikutnya, kecamatan dan kabupaten diisi otomatis. Untuk desa baru, isi ketiga kolom sekali terlebih dahulu.
