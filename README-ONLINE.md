# ABSEN MASKANA — Versi Multi-HP / Multi-Laptop

Versi ini menggunakan Supabase sebagai database online dan Supabase Realtime agar data peserta dan kehadiran dapat dilihat bersama dari beberapa perangkat.

## Setup

1. Buka project Supabase.
2. Masuk ke **SQL Editor** → **New query**.
3. Salin seluruh isi `supabase-schema.sql`, lalu klik **Run**.
4. Pastikan tidak ada error.
5. Upload isi folder project ini ke GitHub.
6. Hubungkan repository GitHub tersebut ke Netlify.
7. Buka website Netlify. Semua perangkat yang membuka website yang sama akan memakai database Supabase yang sama.

## Catatan keamanan

`supabase-config.js` berisi **publishable key** (`sb_publishable_...`). Supabase menyatakan publishable key aman berada di aplikasi browser, tetapi tabel harus dilindungi dengan RLS. Jangan pernah memasukkan `sb_secret_...` atau `service_role` key ke project frontend.

Versi awal ini belum memakai login admin, sehingga policy database sengaja mengizinkan operasi peserta dan absensi untuk role `anon`. Artinya URL aplikasi sebaiknya hanya dibagikan kepada panitia. Setelah sistem berjalan, tahap berikutnya yang disarankan adalah menambahkan **login admin/panitia** dan memperketat RLS.

## Migrasi data lama

Saat database online masih kosong, aplikasi akan mendeteksi data `localStorage` dari perangkat lama dan menawarkan untuk mengunggah peserta serta absensi ke Supabase. Setelah migrasi selesai, perangkat lain dapat melihat data tersebut.
