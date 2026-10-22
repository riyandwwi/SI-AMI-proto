# SI-AMI ITBMP — Sistem Informasi Audit Mutu Internal Kampus ITBMP

Aplikasi web Audit Mutu Internal (AMI) berbasis **Next.js 15 (App Router) + PostgreSQL + Prisma ORM + Tailwind CSS**, dirancang untuk **Kampus ITBMP** dengan **3 Program Studi**:
1. **Bisnis Digital** (`PRODI-BD`)
2. **Aktuaria** (`PRODI-AKT`)
3. **Perancangan Wilayah dan Kota** (`PRODI-PWK`)

---

## 4 Peran Pengguna (Role) & Akun Awal (Seed)

Semua akun awal memiliki **Password Default: `123`**:

| Role | Username | Password | Program Studi | Wewenang Utama |
| :--- | :--- | :--- | :--- | :--- |
| **1. Super Admin** | `superadmin` | `123` | Bisnis Digital | Membuat akun baru (input Nama, NIM/NUPTK, Prodi, Role LPM/Auditor/Auditee, Username — otomatis password `123`), melihat username & password, mengganti password, serta menghapus akun. |
| **2. LPM** | `lpm` | `123` | Bisnis Digital | Mengatur sesi/tahapan AMI (*Stage-Gate Lock*), mengelola & mengunci indikator (*Source-Lock*), membuat usulan tim bebas CoI, mengesahkan jadwal & laporan AMI, dan melihat rekap/log. |
| **3. Auditor** | `auditor_bd` / `auditor_akt` / `auditor_pwk` | `123` | Bisnis Digital / Aktuaria / PWK | Memeriksa tautan Google Drive auditee (*Audit Dokumen*), menandai fokus konfirmasi lapangan, menetapkan klasifikasi temuan (*Melampaui, Mencapai, OB, KTS Minor, KTS Mayor*), dan memverifikasi bukti RTL. |
| **4. Auditee** | `auditee_bd` / `auditee_akt` / `auditee_pwk` | `123` | Bisnis Digital / Aktuaria / PWK | Mengisi klaim evaluasi diri & menempelkan **Link Google Drive** bukti dukung sebelum *cut-off*, serta mengunggah link Drive bukti perbaikan (RTL). |

*(Setiap pengguna juga dapat mengganti password-nya sendiri melalui tombol **Ganti Password** di pojok kanan atas).*
