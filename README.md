# SI-AMI ITBMP — Sistem Informasi Audit Mutu Internal Kampus ITBMP

Aplikasi web Audit Mutu Internal (AMI) berbasis **Next.js 15 (App Router) + PostgreSQL + Prisma ORM + Tailwind CSS**, dirancang khusus untuk **Kampus ITBMP** berdasarkan prinsip pada *Buku Panduan Menyusun Rencana Audit Mutu Internal dengan Menggunakan AI* (`PANDUAN/AMI-AI/003`).

---

## 4 Prinsip Utama yang Diterapkan

1. **Source-Lock (Penguncian Sumber Data):** Indikator SPMI dan daftar unit sasaran dikunci oleh LPM sebelum pemetaan tim dan pengisian bukti dimulai.
2. **One Workflow (Satu Alur Terpadu):** Bukti tautan Google Drive dari Auditee $\rightarrow$ Audit Dokumen (*Desk Audit*) $\rightarrow$ Fokus Audit Lapangan $\rightarrow$ Klasifikasi Temuan (Melampaui/Mencapai/OB/KTS) $\rightarrow$ Rencana Tindak Lanjut (RTL) tersimpan dalam satu rangkaian data utuh.
3. **Team Continuity (Kontinuitas Tim Auditor):** Tim auditor yang memeriksa dokumen suatu unit otomatis dipertahankan untuk audit lapangan pada unit yang sama (perubahan tim setelah disahkan wajib mencantumkan alasan resmi).
4. **Human-in-the-Loop (Persetujuan Manusia):** Sistem dapat mengusulkan pembagian tim otomatis bebas *Conflict of Interest* (CoI) dengan beban kerja seimbang serta melakukan *Quality Control Cross-Check* (menandai jadwal kosong sebagai `"Perlu verifikasi manual"`), namun pengesahan tetap dilakukan oleh LPM dan Pimpinan.

---

## 5 Peran Pengguna (Role) & Akun Awal (Seed)

Setelah menjalankan `npm run db:seed`, Anda dapat langsung login tanpa OTP menggunakan akun berikut (semua password awal: **`password123`**):

| Role | Username | Password | Wewenang Utama |
| :--- | :--- | :--- | :--- |
| **1. Super Admin** | `superadmin` | `password123` | Menambah akun, **melihat username & password asli** jika user lupa, mengganti password akun tanpa OTP. |
| **2. LPM** | `lpm` | `password123` | Mengatur sesi/tahapan AMI (*Stage-Gate Lock*), mengelola & mengunci indikator (*Source-Lock*), membuat usulan tim bebas CoI, menyetujui jadwal, dan melihat rekap/log. |
| **3. Auditor** | `auditor_hendra` / `auditor_siti` / `auditor_budi` | `password123` | Memeriksa tautan Google Drive auditee (*Audit Dokumen*), menandai fokus konfirmasi lapangan, menetapkan klasifikasi temuan (*Melampaui, Mencapai, OB, KTS Minor, KTS Mayor*), dan memverifikasi bukti RTL. |
| **4. Auditee** | `prodi_ti` / `prodi_si` / `upt_perpus` | `password123` | Mengisi klaim evaluasi diri & menempelkan **Link Google Drive** bukti dukung sebelum *cut-off*, serta mengunggah link Drive bukti perbaikan (RTL). |
| **5. Pimpinan** | `pimpinan` | `password123` | Memantau dashboard eksekutif ketercapaian standar mutu ITBMP, memonitor penyelesaian KTS/OB, dan mengesahkan laporan AMI institusi. |

*(Setiap pengguna juga dapat mengganti password-nya sendiri melalui tombol **Ganti Password** di pojok kanan atas).*

---

## Cara Menjalankan di Lokal

1. **Salin file `.env.example` menjadi `.env`:**
   ```bash
   cp .env.example .env
   ```
   Isi `DATABASE_URL` dan `DIRECT_URL` dengan URL database PostgreSQL Anda (misalnya dari **Neon.tech**, **Supabase**, **Vercel Postgres**, atau PostgreSQL lokal), serta isi `AUTH_SECRET` dan `PASSWORD_ENC_KEY` (minimal 32 karakter).

2. **Dorong skema ke database PostgreSQL & jalankan seed data awal:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

3. **Jalankan server development:**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di browser.

---

## Cara Deploy ke Vercel

1. Push repositori ini ke GitHub / GitLab.
2. Buat project baru di **Vercel** dan hubungkan ke repositori tersebut.
3. Tambahkan **Environment Variables** di Vercel:
   * `DATABASE_URL`
   * `DIRECT_URL`
   * `AUTH_SECRET` (minimal 32 karakter)
   * `PASSWORD_ENC_KEY` (minimal 32 karakter)
4. Klik **Deploy** (script `build` otomatis menjalankan `prisma generate && next build`).
