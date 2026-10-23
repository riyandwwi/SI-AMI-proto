# AMINet Enterprise: Buku Produk Digital

**Audit Mutu Internal Terintegrasi & Cerdas**
Panduan ringkas produk, arsitektur, dashboard, tata kelola, keamanan, AI, otomasi, dan dukungan pengguna.

- **Versi:** Enterprise Quality v2.5 (Agustus 2026)
- **Penulis/Pengembang:** Ir. Agus Kurniawan, S.T., M.T.
- **Kode Produksi:** 23082026 – VIII
- **Hak Cipta:** © Agus Kurniawan 2026
- **Kontak:** mbotzz.webid@gmail.com
- **Tag cover:** SPMI, PPEPP, Audit Digital, Gemini AI

## Identitas Produk

Web app Audit Mutu Internal (AMI) untuk perguruan tinggi berbasis Google Apps Script dengan antarmuka responsif, dashboard analitik, alur audit end-to-end, dan dukungan AI.

## Daftar Isi

| Bagian | Judul |
|---|---|
| 00 | Lembar Serah Terima Produk |
| 01 | AMINet dalam Satu Pandangan |
| 02 | Arsitektur & Spesifikasi Produk |
| 03 | Akses Sistem & Profil Pengguna |
| 04 | Tampilan Dashboard Produk |
| 05 | Alur Operasional Audit |
| 06 | Pengaturan & Fitur Operasional |
| 07 | Peran Pengguna & Otorisasi |
| 08 | Fungsi AI, Otomasi & Pengingat |
| 09 | Keamanan Sistem |
| 10 | Larangan & Tata Kelola |
| 11 | Dukungan & Kontak Pengembang |
| 12 | Kesimpulan & Checklist Implementasi |

---

## 00. Lembar Serah Terima Produk

Halaman serah terima produk dari pengembang kepada pengguna/pengelola aplikasi.

| Peran | Nama/Jabatan | Tanda Tangan | Tanggal |
|---|---|---|---|
| Pengembang | Agus Kurniawan | (kosong) | 23/08/2026 |
| Pengguna | Nama Customer | (kosong) | (kosong) |

**Ruang lingkup serah terima**

Berkas aplikasi terdiri atas frontend HTML/JavaScript dan backend Google Apps Script. Konfigurasi produksi, akun deployer, akses basis data, Google Drive, serta Script Properties tetap harus diserahkan melalui kanal internal yang aman.

**Catatan penerimaan**

- ✓ Versi aplikasi telah diuji pada lingkungan Google Workspace/Apps Script institusi.
- ✓ Hak akses administrator, lokasi data, dan folder Drive telah dikonfirmasi.
- ✓ Dokumen ini menjadi panduan ringkas; konfigurasi rahasia tidak dicantumkan di dalam buku produk.

---

## 01. AMINet dalam Satu Pandangan

Platform SPMI berbasis web untuk mengelola siklus Audit Mutu Internal secara end-to-end.

AMINet Enterprise menyatukan perencanaan program audit, instrumen, evaluasi mandiri, verifikasi dokumen, visitasi lapangan, temuan, PTK, laporan, evaluasi, presensi, kuisioner, serta dukungan pengguna. Bantuan Gemini AI ditempatkan sebagai asisten penyusunan draf, sementara keputusan audit tetap berada pada manusia.

**Ilustrasi ekosistem AMINet Enterprise:** satu portal untuk kolaborasi lintas peran, bukti mutu, analitik, dan tindak lanjut. Portal pusat (AMINet Enterprise: Audit Mutu Internal Terintegrasi, SPMI • PPEPP • AI-assisted) terhubung dengan peran Tamu, Super Admin, Lead Auditor, Penjaminan Mutu, Auditor, dan Auditee. Modul yang terhubung: Program Audit, Instrumen, Audit Dokumen, Audit Lapangan, Temuan & PTK, Laporan, Evaluasi AI, serta Presensi & Kuisioner.

| Pilar | Penjelasan |
|---|---|
| **Terintegrasi** | Program, unit, auditor, eviden, temuan, PTK, laporan, dan dokumen berada dalam satu alur. |
| **Terukur** | KPI, compliance rate, klasifikasi temuan, dan implementasi PPEPP divisualisasikan pada dashboard. |
| **Tertelusur** | History/log aktivitas, status verifikasi, tanda tangan elektronik, dan QR mendukung audit trail. |
| **Cerdas** | AI membantu daftar tilik, perumusan temuan, evaluasi–analisis, dan percakapan berbasis konteks akses. |

---

## 02. Arsitektur & Spesifikasi Produk

Ringkasan teknologi dan layanan yang digunakan pada implementasi aplikasi.

**Arsitektur konseptual empat lapis** (rancangan ringan berbasis Google Workspace dengan antarmuka web responsif):

1. **Presentation Layer:** HTML, Tailwind CSS, JavaScript, Lucide, Google Charts, SheetJS.
2. **Application Layer:** Google Apps Script (routing, RBAC, session, CRUD, export, reminder, QR verification).
3. **Data & Document Layer:** Google Sheets sebagai database; Google Drive untuk eviden, foto profil, TTD, kop, dokumen.
4. **Integration Layer:** GmailApp (OTP & reminder), Gemini API, UrlFetchApp, Script Properties.

**Ringkasan kontrol:** OTP 6 digit / 5 menit • Sesi sliding 120 menit • Export filtering di sisi server • Maks. upload 2 MB • Audit trail + QR/e-sign.

| Komponen | Spesifikasi |
|---|---|
| Jenis produk | Web app AMI perguruan tinggi; responsif dan mendukung mode gelap. |
| Frontend | HTML, Tailwind CSS, JavaScript, Lucide Icons, Google Charts, SheetJS. |
| Backend | Google Apps Script untuk routing, otorisasi, layanan data, dokumen, ekspor, email, dan AI. |
| Data & dokumen | Google Sheets sebagai basis data; Google Drive untuk eviden, dokumen, foto, logo, dan tanda tangan. |
| Komunikasi | GmailApp untuk OTP, pengingat tenggat, dan tiket laporan masalah. |
| Kecerdasan buatan | Gemini API melalui Script Properties; tersedia respons fallback saat kunci belum dikonfigurasi. |
| Keluaran | PDF/Excel, Log Status, PTK, evaluasi–analisis, daftar tilik, presensi, dan kuisioner. |

---

## 03. Akses Sistem & Profil Pengguna

Login tanpa password menggunakan OTP email, dilengkapi profil, role, unit kerja, foto, dan tanda tangan elektronik.

### Login awal sistem

- **Link singkat:** https://s.id/AminetEnterprise (tersedia juga QR code "Pindai untuk membuka AMINet Enterprise")
- **Alamat email:** email pengguna yang terdaftar/registrasi mandiri
- **Kredensial:** OTP 6 digit dikirim melalui email
- **Masa berlaku OTP:** 5 menit
- **Sesi aktif:** sliding session 120 menit tanpa aktivitas

> **Kontrol OTP:** maksimal 5 permintaan per hari, jeda kirim ulang 60 detik, dan maksimal 3 percobaan verifikasi per kode.

| Fitur | Penjelasan |
|---|---|
| Registrasi mandiri | Antarmuka menyediakan pendaftaran awal dengan akses terbatas; administrator menetapkan role/unit produksi. |
| Profil saya | Pengguna dapat memelihara identitas, nomor kontak, foto profil, serta tanda tangan elektronik. |
| Role & unit kerja | Menu dan aksi berubah sesuai RBAC dan ruang lingkup unit/penugasan. |
| Preferensi UI | Mode gelap, sidebar responsif/collapsed, dan pencarian global untuk navigasi cepat. |

> **⚠ Catatan konsistensi versi:** Frontend menamai registrasi mandiri sebagai "Tamu", sedangkan satu komentar backend masih menyebut akun baru sebagai "Auditee". Selaraskan konfigurasi produksi sebelum go-live.

---

## 04. Tampilan Dashboard Produk

Pusat pemantauan progres, kepatuhan, temuan, dan implementasi PPEPP pada Program Audit yang aktif.

**Mockup dashboard** (angka pada ilustrasi bukan data produksi): menu samping berisi Dashboard Mutu, Program Audit, Audit Dokumen, Audit Lapangan, Temuan & PTK, Laporan Audit, Evaluasi & Analisis, Presensi, Download, Kuisioner, Pengaturan, dan History. Halaman "Pusat Penjaminan Mutu Internal" menampilkan kartu KPI (contoh: Unit Diaudit 12, Instrumen Aktif 135, Ketidaksesuaian 24, Compliance Dokumen 86,7%, Compliance Lapangan 73,3%), Timeline Proses Audit (Dokumen Auditee → Verifikasi Auditor → Audit Lapangan → Penyelesaian PTK), grafik Tren Hasil Kepatuhan & Temuan, donat Distribusi PPEPP (Penetapan, Pelaksanaan, Evaluasi, Pengendalian, Peningkatan), serta tombol "Tanya AI Penjaminan Mutu".

| Komponen | Penjelasan |
|---|---|
| KPI Utama | Unit kerja diaudit, instrumen aktif, ketidaksesuaian, compliance rate dokumen dan lapangan. |
| Timeline Audit | Tahapan siklus audit ditampilkan kronologis dan dapat dimonitor status penyelesaiannya. |
| Analitik Mutu | Tren kepatuhan, klasifikasi temuan, sebaran PPEPP, dan temuan per unit kerja. |
| Evaluasi & Analisis | Draf evaluasi, analisis, tindak lanjut, dan pencetakan PDF sebagai bahan RTM. |

**Modul pendukung dashboard:** Presensi kegiatan • Kuisioner kepuasan • Download dokumen • History • Laporkan Masalah • Global Search

---

## 05. Alur Operasional Audit

Satu siklus digital dari inisialisasi Program Audit hingga evaluasi dan perbaikan berkelanjutan.

**Siklus Operasional Audit Mutu Internal:** Program Audit → Instrumen → Penugasan Auditor → Audit Dokumen → Audit Lapangan → Temuan & PTK → Laporan Audit → Evaluasi & Analisis → kembali ke Program Audit. Di pusat siklus: *PPEPP • Bukti Mutu • Audit Trail • Perbaikan Berkelanjutan*.

| Langkah | Tahap | Penjelasan |
|---|---|---|
| 1 | Buat Program Audit | Tetapkan nama, periode, rentang tanggal, status siklus, dan timeline. |
| 2 | Masukkan Instrumen | Tambahkan unit auditee; input manual atau impor Excel, termasuk tahap PPEPP. |
| 3 | Tetapkan Auditor | Tentukan Auditor/Lead Auditor dan penugasan per unit serta program (surat tugas + sertifikat). |
| 4 | Audit Dokumen | Auditee mengisi evaluasi mandiri/eviden; Auditor memilih Sesuai atau Cek Lapangan. |
| 5 | Audit Lapangan | Gunakan daftar tilik (4W+1H); catat kondisi objektif dan klasifikasi hasil audit. |
| 6 | Temuan & PTK | KTS Mayor/Minor memicu PTK; Auditee mengisi akar masalah (5-Why), koreksi, dan pencegahan. |
| 7 | Laporan Audit | Susun Log Status, tanda tangan elektronik, serta verifikasi QR dan keluaran dokumen. |
| 8 | Evaluasi & Analisis | Analisis tren, PPEPP, unit kerja, kepuasan, serta tindak lanjut untuk RTM. |

---

## 06. Pengaturan & Fitur Operasional

Fitur administratif dan utilitas yang mendukung pengelolaan AMI dalam penggunaan sehari-hari.

| Fitur | Penjelasan |
|---|---|
| Mengatur User | Kelola akun, status aktif, role, unit kerja, serta reset limit OTP sesuai kewenangan. |
| Mengatur Unit Kerja | Kelola master unit dan kepala unit sebagai dasar ruang lingkup proses audit. |
| Mengatur Kop Surat | Simpan identitas institusi, logo, dan elemen dokumen resmi untuk keluaran laporan. |
| Dokumen Download | Publikasikan pedoman/formulir/regulasi berupa link atau unggahan file yang dibatasi ukuran. |
| History & Audit Trail | Aktivitas penting dicatat untuk penelusuran perubahan dan akuntabilitas pengguna. |
| Global Search | Cari data lintas modul dari satu kolom pencarian pada navbar aplikasi. |
| Ekspor Terproteksi | Temuan, PTK, dan daftar tilik diekspor berdasarkan ruang lingkup role/unit/penugasan. |
| Kebersihan Data | Migrasi schema, pembersihan sesi kadaluarsa, dan pengelolaan struktur sheet mendukung pemeliharaan. |

> **Ruang lingkup ekspor:** Super Admin, Penjaminan Mutu, dan Lead Auditor dapat melihat seluruh unit. Role lain dibatasi oleh unit sendiri, unit yang dipimpin, dan/atau penugasan audit aktif.

> **✓ Ukuran unggahan:** Eviden dan dokumen pendukung yang dikendalikan aplikasi divalidasi hingga maksimal 2 MB pada backend.

---

## 07. Peran Pengguna & Otorisasi

Hak akses dibedakan untuk menjaga tanggung jawab, independensi, dan akuntabilitas proses audit.

| Role | Fokus | Akses Kunci |
|---|---|---|
| Super Admin | Konfigurasi & kendali sistem | Pengguna, unit, kop, program, instrumen, OTP, history, dokumen, kuisioner, laporan. |
| Penjaminan Mutu | Pengelola siklus AMI | Program, instrumen, monitoring, analitik, evaluasi, dokumen, kuisioner, laporan. |
| Lead Auditor | Pengendali mutu audit | Koordinasi tim, timeline, verifikasi lapangan/observasi, efektivitas PTK, presensi. |
| Auditor | Pelaksana pemeriksaan | Verifikasi dokumen, daftar tilik, visitasi, klasifikasi temuan, ekspor sesuai penugasan. |
| Auditee | Pemilik proses/unit | Evaluasi mandiri, unggah eviden, respons PTK, bukti perbaikan, presensi/kuisioner. |
| Tamu | Akses awal terbatas | Registrasi awal pada antarmuka dan akses operasional yang dibatasi hingga role ditetapkan. |

> **◆ Independensi auditor:** Penugasan auditor dapat divalidasi terhadap unit kerja agar konflik kepentingan dapat dihindari dalam konfigurasi dan proses AMI.

| Kontrol | Penjelasan |
|---|---|
| Verifikasi Lead | Hasil audit lapangan yang telah diverifikasi dapat dikunci dari perubahan berikutnya. |
| Integritas PTK | KTS Mayor/Minor mengikuti alur PTK sampai ditutup Lead Auditor; observasi memiliki verifikasi tersendiri. |
| Cakupan AI | Ringkasan konteks untuk AI mengikuti role dan ruang lingkup akses pengguna. |
| Cakupan ekspor | Kontrol server-side mencegah role biasa mengekspor data di luar unit/penugasan yang berhak. |

---

## 08. Fungsi AI, Otomasi & Pengingat

Gemini AI membantu penyusunan daftar tilik, perumusan temuan, analisis akar masalah, evaluasi-analisis, dan percakapan mutu; keputusan akhir tetap berada pada personel berwenang.

**Ilustrasi:** panel "Gemini AI Assistant" berisi 4W+1H, Bahasa Temuan, 5-Why, Evaluasi & Analisis, dan Chat Kontekstual. Panel "Otomasi Operasional" berisi pengingat H-3 (aktivitas mendekati tenggat), H-1 (prioritas tinggi), H-0 (notifikasi batas waktu hari ini), dan trigger harian opsional pukul 07:00. `GEMINI_API_KEY` disimpan di Script Properties.

| Fungsi | Penjelasan |
|---|---|
| Daftar Tilik 4W+1H | AI menyusun pertanyaan visitasi berdasarkan instrumen dan penjelasan Auditee dengan kaidah Apa/Siapa/Kapan/Di mana/Bagaimana. |
| Perumusan Temuan | AI merekomendasikan jenis hasil audit lapangan dan membantu merumuskan bahasa temuan dari kondisi objektif yang dicatat auditor. |
| Analisis Akar Masalah 5-Whys | Asisten Gemini AI membantu menyusun analisis akar masalah 5-Whys sebagai bahan penetapan tindakan perbaikan. |
| Evaluasi, Analisis & Tindak Lanjut | AI menyusun draf tiga bagian berdasarkan grafik dan hasil audit untuk ditinjau serta disunting pengelola mutu. |
| AI Chat Kontekstual | Chatbot membantu analisis dokumen/kriteria akreditasi, draf temuan, pertanyaan mutu, dan mitigasi risiko sesuai konteks akses pengguna. |
| Fallback Aman | Jika `GEMINI_API_KEY` belum tersedia, aplikasi mengembalikan respons fallback tanpa membuka kunci rahasia. |

> **◆ Otomasi Pengingat:** Email H-3, H-1, dan hari-H mendukung pengingat PTK serta aktivitas audit; trigger harian dapat disetel pukul 07.00.

> **✦ Human-in-the-loop:** Hasil AI wajib ditinjau, diedit, dan disahkan personel berwenang. AI berfungsi sebagai asisten draf, bukan pengganti keputusan auditor.

---

## 09. Keamanan Sistem

Kontrol aplikasi perlu dipadukan dengan konfigurasi produksi dan kebijakan data institusi.

**Kontrol tersedia:** OTP (6 digit, 5 menit, maks. 3 percobaan) • Rate limit (maks. 5 permintaan/hari, jeda kirim ulang 60 detik) • Session (sliding 120 menit) • RBAC (akses menu dan fungsi dibatasi role) • Upload (validasi 2 MB di frontend & backend) • Export (penyaringan data unit di server sebelum dikirim) • Audit trail (history aktivitas, e-sign, QR verification).

**Tinjauan sebelum go-live:**

- File upload saat ini dibagikan sebagai "Anyone with link".
- Web app menggunakan X-Frame-Options ALLOWALL.
- Endpoint verifikasi QR bersifat publik sesuai desain.
- Tinjau izin Workspace, retensi, backup, dan kepemilikan Drive.
- Jangan mengekspos API key, spreadsheet ID, atau konfigurasi internal.

| Komponen | Spesifikasi |
|---|---|
| OTP & sesi | OTP 6 digit berlaku 5 menit; maks. 3 percobaan; maks. 5 permintaan/hari; resend 60 detik; sesi sliding 120 menit. |
| Akun & RBAC | Akun harus aktif; fungsi dan cakupan data dibatasi role, unit, kepemimpinan unit, atau penugasan. |
| Audit trail | Aktivitas kunci ditulis ke History/LogAktivitas untuk penelusuran. |
| Unggahan | Validasi backend membatasi eviden/dokumen tertentu sampai 2 MB. |
| Rahasia aplikasi | `GEMINI_API_KEY` dan `DEVELOPER_EMAIL` dibaca dari Script Properties. |
| Verifikasi publik | Endpoint QR PTK dan Log Status dapat dibuka tanpa login sesuai desain verifikasi dokumen. |

> **⚠ Tinjauan produksi:** File unggahan saat ini dapat disetel "Anyone with link" dan web app memakai X-Frame-Options ALLOWALL. Tinjau kebijakan sharing Drive, embedding, data pada endpoint QR publik, izin Workspace, retensi, backup, dan akun deployer sebelum go-live.

---

## 10. Larangan & Tata Kelola

Pedoman penggunaan untuk menjaga kerahasiaan, integritas data, independensi audit, dan kualitas keputusan.

### Dilarang

- ✗ Membagikan OTP, session, atau akun kepada pihak lain.
- ✗ Mengunggah data rahasia/pribadi ke tautan publik tanpa klasifikasi dan persetujuan.
- ✗ Memalsukan eviden, mengubah catatan audit, atau menghapus jejak tanpa kewenangan.
- ✗ Menugaskan auditor dengan konflik kepentingan terhadap unit auditee.
- ✗ Mengekspos API key, Script Properties, ID basis data, atau konfigurasi internal.
- ✗ Mengubah hasil yang sudah dikunci/verifikasi atau PTK yang telah ditutup.

### Praktik Wajib

- ✓ Gunakan akun institusi dan role sesuai tanggung jawab.
- ✓ Pastikan eviden relevan, sah, mutakhir, dan izin aksesnya benar.
- ✓ Bedakan fakta objektif, kriteria, interpretasi, dan rekomendasi.
- ✓ Tinjau hasil AI sebelum digunakan sebagai keluaran audit.
- ✓ Review akses Drive, backup, audit trail, status akun, dan trigger secara berkala.
- ✓ Laporkan bug/anomali melalui menu Laporkan Masalah agar tercatat.

> **⚠ Jika terjadi insiden:** Hentikan aktivitas berisiko, simpan bukti kejadian, informasikan administrator, amankan konfigurasi terdampak, tinjau hak akses, dan dokumentasikan tindak lanjut.

---

## 11. Dukungan & Kontak Pengembang

Gunakan kanal di dalam aplikasi agar isu otorisasi, kesalahan proses, dan gangguan teknis tercatat serta dapat ditindaklanjuti.

**Alur dukungan:** Pengguna (laporkan masalah) → AMINet (simpan tiket + metadata) → Email (kirim ke `DEVELOPER_EMAIL`) → Admin/Developer (Status Baru → Diproses → Selesai).

| Fitur | Penjelasan |
|---|---|
| Laporkan Masalah | Semua role dapat membuat tiket berisi institusi, kategori, halaman, judul, dan deskripsi kejadian. |
| Notifikasi Pengembang | Tiket disimpan pada basis data dan dikirim via email apabila `DEVELOPER_EMAIL` sudah dikonfigurasi. |
| Status Tiket | Administrator/Penjaminan Mutu dapat memantau dan memperbarui status penanganan tiket. |
| Dukungan Otorisasi | Alamat dukungan institusi pada antarmuka harus diganti dengan alamat resmi sebelum implementasi. |

### Checklist Implementasi

| No | Tahap | Isi |
|---|---|---|
| 01 | Konfigurasi | Set `GEMINI_API_KEY` dan `DEVELOPER_EMAIL`. |
| 02 | Master Data | Validasi pengguna, role, unit kerja, kop institusi. |
| 03 | Keamanan | Tinjau Drive sharing, endpoint publik, retensi dan backup. |
| 04 | Pilot | Uji satu Program Audit dari instrumen sampai laporan. |
| 05 | Pelatihan | Briefing admin, auditor, auditee, dan pelaporan masalah. |
| 06 | Evaluasi | Pantau history, kuisioner, analitik, dan tindak lanjut RTM. |

### Kontak Pengembang

- **Pengembang:** Ir. Agus Kurniawan, S.T., M.T.
- **Email:** mbotzz.webid@gmail.com
- **Identitas kode:** @mbotzz.webid
- **Dukungan:** Gunakan menu Laporkan Masalah; tiket diteruskan ke `DEVELOPER_EMAIL` setelah dikonfigurasi.

---

## 12. Kesimpulan & Checklist Implementasi

AMINet menghubungkan data, kolaborasi, pengendalian, audit trail, AI, dan analitik menjadi satu siklus peningkatan mutu.

AMINet Enterprise mengintegrasikan program, instrumen, audit dokumen, visitasi, temuan, PTK, Log Status, presensi, kuisioner, dukungan pengguna, dan analitik mutu sebagai dasar Rapat Tinjauan Manajemen serta perbaikan berkelanjutan. Nilai produk paling tinggi dicapai ketika keamanan, tata kelola data, dan disiplin proses diterapkan konsisten.

### Checklist Go-Live

| No | Tahap | Isi |
|---|---|---|
| 01 | Konfigurasi | Set `GEMINI_API_KEY` dan `DEVELOPER_EMAIL` di Script Properties; jangan ditulis di sisi klien. |
| 02 | Master Data | Validasi pengguna, role, unit kerja, kepala unit, kop institusi, program, dan instrumen. |
| 03 | Keamanan | Tinjau sharing Drive, endpoint QR publik, X-Frame/embedding, retensi, backup, dan akun deployer. |
| 04 | Pilot | Uji satu Program Audit lengkap: dokumen → lapangan → temuan/PTK → laporan → evaluasi. |
| 05 | Pelatihan | Briefing administrator, Penjaminan Mutu, Lead Auditor, Auditor, dan Auditee per skenario role. |
| 06 | Monitoring | Aktifkan/validasi trigger pengingat, audit trail, kuisioner, presensi, tiket, dan tindak lanjut RTM. |

> **Catatan sumber:** Buku produk disusun berdasarkan implementasi pada `index.html` dan `Code.gs` yang dilampirkan. Angka dalam ilustrasi dashboard bersifat demonstratif; istilah, fungsi, batasan, dan konfigurasi mengikuti sumber aplikasi.

---

*AMINet Enterprise · Audit Mutu Internal Terintegrasi & Cerdas*
