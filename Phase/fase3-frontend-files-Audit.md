# Absensi WFH: Dokumen Gabungan Fase 3

Isi: (1) ringkasan serah-terima Fase 4, (2) laporan audit antislop, (3) DESIGN.md.

---

## Serah-Terima Fase 3 → Fase 4 (Frontend HRD)
Status: kode ditulis dan diaudit lewat membaca ulang. BELUM di-build atau diuji di browser (R-35 belum lulus).
### 1. Struktur frontend/ (final)
- Root: package.json, .env(.example), index.html, vite.config.ts (alias @=src, port 5173), tsconfig.json, postcss.config.js, tailwind.config.ts, DESIGN.md
- src/: main.tsx, App.tsx, index.css, vite-env.d.ts | lib/: utils(cn), types, api, errors, format, routes
- auth/: AuthContext.tsx, ProtectedRoute.tsx | hooks/: useDebounce, useApiList, useServerClock | layouts/: AppShell.tsx
- components/: FullPageLoader, PageHeader, EmptyState, ErrorState, Pagination, AuthedImage, LiveClock, PhotoDropzone, Stamp
- components/ui/: button, input, textarea, label, select, badge, card, skeleton, dialog
- pages/: LoginPage; employee/AttendancePage; admin/EmployeesPage, EmployeeFormDialog, AttendanceMonitorPage
- Backend tambahan: src/time/{time.controller,time.module}.ts (GET /api/time). TimeModule harus terdaftar di app.module.ts.
### 2. Design token (src/index.css :root, kanal RGB, dipetakan di tailwind.config.ts)
- canvas #F7F5F0, card #FFFFFF, ink #1F1D1A, muted #6B665E, line #E4DFD5 (pemisah), edge #8F897E (batas input)
- accent #1E4D8C, accent-soft #E4EBF5, accent-ink #17396B (teks kecil di atas accent-soft), present #2F6F5E/#E3EFEA, danger #A12B2B/#F8E4E1
- Radius sm 6 / md 8 / lg 12 px. Font: sans DM Sans Variable, display Fraunces Variable (@fontsource, lokal). Spasi: skala default Tailwind, container max-w-7xl px-4 sm:px-6.
- Terrakota asli (#B04A22/#F6E7DF/#9A3F1B) ada di DESIGN.md untuk dikembalikan.
### 3. Komponen reusable (path di src/components/, props)
- ui/Button: variant primary|secondary|ghost|danger|danger-ghost, size md|sm|icon, asChild. `<Button variant="secondary" size="sm">Batal</Button>`
- ui/Input, Textarea, Label, Select (select native), Card+CardTitle, Skeleton({className}), Badge variant neutral|present|accent|danger
- ui/Dialog (Radix): Dialog open onOpenChange, DialogContent, DialogTitle, DialogDescription. Contoh: EmployeeFormDialog.
- PageHeader({title,description?,actions?}), EmptyState({icon,title,description?,action?}), ErrorState({message,onRetry?}), Pagination({meta,onPage,disabled?})
- LiveClock({now,status,className}) dengan `const {now,status}=useServerClock()`
- PhotoDropzone({file,onChange,stampName,now,disabled}): validasi jpg/png/webp, maks 3 MB, stempel "Pratinjau"
- Stamp({label,time,date,name?,className}): label "Pratinjau" (lokal) atau "Tercatat" (waktu server)
- AuthedImage({attendanceId,alt,className}). Hooks: useApiList<T>(path, params|null) → {data,meta,loading,error,refetch}; useDebounce(v,400)
- TIDAK ADA: DataTable (tabel `<table>` inline di tiap halaman, konstanta TH/TD) dan toast (banner role=status di EmployeesPage). Ekstrak di Fase 4 bila perlu.
### 4. Auth dan Axios
- lib/api.ts: baseURL VITE_API_URL, timeout 30 dtk, interceptor request menambah Bearer dari localStorage `absensi.token`.
- Interceptor response: 401 selain /auth/login → hapus token, dispatch event `auth:expired`; AuthContext mendengarnya, user=null, ProtectedRoute ke /login.
- AuthProvider: ada token → GET /auth/me saat mount (loading=true); gagal → token dibuang. login() simpan token+user; logout() hapus keduanya.
- ProtectedRoute({roles?}): loading → FullPageLoader; tanpa user → /login; role salah → homeFor(role) (EMPLOYEE /absensi, ADMIN_HRD /admin/karyawan).
### 5. Route
- /login, / (redirect per role), /absensi (EMPLOYEE), /admin/karyawan dan /admin/absensi (ADMIN_HRD), * → 404. Tidak ada route placeholder.
### 6. Halaman HRD
- Selesai: daftar karyawan (cari, filter peran/status, paginasi), tambah/ubah (dialog, aktifkan ulang lewat checkbox), nonaktifkan (soft delete + konfirmasi), monitoring absensi (filter tanggal dan nama, paginasi, thumbnail foto).
- Belum: drawer HRD (Fase 4), klik baris/detail absensi, foto ukuran penuh, ekspor, ringkasan/dasbor.
### 7. Mengambil foto
- AuthedImage: api.get(`/attendances/${id}/photo`, {responseType:'blob'}) → URL.createObjectURL; revoke saat unmount/ganti id. Jangan pakai photoUrl mentah. Tiap thumbnail memuat foto penuh (belum ada endpoint thumbnail).
### 8. Library (rentang di package.json, belum ada npm install terverifikasi)
- react/react-dom ^18.3.1, react-router-dom ^6.28.0, axios ^1.7.7, vite ^5.4.11, typescript ~5.6.3, tailwindcss ^3.4.15, lucide-react ^0.460.0
- @radix-ui/react-dialog ^1.1.2, react-slot ^1.1.0, class-variance-authority ^0.7.0, clsx ^2.1.1, tailwind-merge ^2.5.4, @fontsource-variable/{dm-sans,fraunces} ^5.1.0
- shadcn/ui BUKAN lewat CLI: komponen ditulis manual bergaya shadcn (cva+Radix+cn). Tidak ada form library, toast library, atau data-fetching library.
### 9. Audit antislop (laporan lengkap di bagian 2 file ini)
- Diperbaiki: #1 em dash, #2 kursor/state aktif, #3 logo→wordmark, #5 kontras, #6 label kapital, #7 hierarki kartu, #9 aksen, #10 DESIGN.md, #11 motif stempel, #15 target sentuh 44px, #16 overflow-x, #17 titik tengah.
- Sengaja dibiarkan: #8 Lucide, #14 bento (dari brief), #12 palet 3 warna inti, #13 mode gelap (ditunda), avatar inisial (dari nama asli).
### 10. Penyimpangan dan masalah terbuka
- Menyimpang dari prompt: Tailwind v3 (bukan v4); shadcn manual; font lokal; aksen terrakota→biru tinta; token tambahan edge/accent-ink/danger; blok akun demo di login (hapus di produksi).
- Terbuka: build belum dijalankan; patch berbasis "ganti teks" bisa gagal jika kode Anda berbeda; status "hari ini" bergantung jam sinkron server (dekat tengah malam bisa meleset jika offline); belum ada tes otomatis.

---

## Bagian 2 (laporan audit antislop)

## Audit antislop 001 (2026-11-03), mode AFTER

Objek: frontend Fase 3 (Absensi WFH). Metode: membaca ulang kode, belum dijalankan (lihat #4).
Prioritas: HIGH = Hard Gate, MEDIUM = Purpose-Gate, LOW = Quality Lock.
Tidak ada yang diubah sampai nomor dipilih.

### HIGH

1. **R-02 Tanda pisah panjang.** `AttendanceMonitorPage.tsx`: kolom Catatan memakai `—` untuk data kosong. Perbaikan: ganti dengan teks "Tanpa catatan".
2. **R-39 Kontrol tanpa cursor-pointer dan state aktif.** `Button`, `NavLink` di AppShell, tombol mata password, tombol tutup dialog, dropzone saat disabled. Hanya ada hover, belum ada `active:` dan `cursor-pointer`. Perbaikan: tambah di `button.tsx` dan komponen terkait.
3. **R-23 Aset visual dibuat tanpa instruksi.** Logo (kotak terrakota + ikon CalendarCheck) di AppShell dan LoginPage (dua kali), serta avatar inisial di AttendancePage. Perbaikan: ganti logo dengan wordmark teks "Absensi WFH" atau tandai placeholder; avatar inisial dipertahankan hanya jika disetujui.
4. **R-35 Belum dijalankan.** Kode ditulis tanpa `npm run build` dan tanpa klik-lewat setiap kontrol. Perbaikan: jalankan `npm run build`, kirim error jika ada, lalu uji skenario di panduan tes.
5. **R-25 Kontras mepet.** Teks terrakota `#B04A22` di atas `accent-soft` `#F6E7DF` sekitar 4,51:1 (hitung manual), padahal dipakai pada teks 12 px (badge, nav aktif). Lolos tipis. Perbaikan: token teks aksen sedikit lebih gelap. Verifikasi dengan alat kontras.

### MEDIUM

6. **R-06 Label kapital dengan tracking lebar tanpa alasan tertulis.** Header tabel, stempel "PRATINJAU", label "Akun demo". Perbaikan: ubah ke sentence case, atau tulis alasannya di DESIGN.md.
7. **R-14 Kartu seragam.** Empat kartu halaman absensi punya border, radius, dan padding identik; belum ada satu titik fokus. Perbaikan: jadikan kartu "Absen hari ini" dominan, dan jam tanpa bingkai kartu.
8. **R-04 Set ikon Lucide.** Dipilih oleh brief. Perbaikan minimal: tulis alasannya. Mengganti set ikon hanya jika diminta.

### LOW

9. **R-30 Mirip tampilan Claude/Anthropic.** Krem hangat + terrakota + serif editorial adalah kombinasi khas. Palet berasal dari brief, jadi ini risiko kemiripan, bukan kesalahan kode. Karena semua warna adalah token di `index.css`, mengubahnya cukup satu file. Opsi: (a) ganti aksen saja, (b) ganti aksen dan latar, (c) biarkan karena dari brief.
10. **R-31 / Design Read / dial belum ada.** Belum ada DESIGN.md berisi alasan satu baris per keputusan dan dial. Usulan: ENERGY 1 / RHYTHM 2 / MOTION 1.
11. **R-20 Motif identitas hanya muncul sekali.** Stempel hanya ada di pratinjau foto. Perbaikan: pakai kembali sebagai tanda "sudah absen" dan di riwayat.
12. **R-29 Palet.** Terrakota, hijau sage, dan merah bahaya = 3 warna inti + netral. Masih dalam batas, dicatat saja.
13. **R-21 / R-34 Tidak ada mode gelap.** Brief menetapkan satu tema terang. Dicatat, tidak diubah kecuali diminta.
14. **R-05 Bento grid.** Diminta eksplisit oleh brief. Dicatat sebagai keputusan sengaja.

### Tindak lanjut (2026-11-03)

Selesai: #1, #2, #3, #5 (HIGH), lalu #6, #7, #9, #10, #11 dan temuan tambahan di bawah.
Dicatat tanpa perubahan kode: #8 (alasan Lucide ada di DESIGN.md), #12, #14.
Ditunda: #13 mode gelap (brief satu tema; butuh uji kontras gelap yang belum bisa saya jalankan).

Temuan tambahan dari skill yang dimuat kemudian:
15. **ui-ux-pro-max, target sentuh.** Tombol 32 dan 40 px di HP. Perbaikan: min-height 44 px pada pointer kasar.
16. **Hallmark Floor 4.** `overflow-x: clip` belum ada di html dan body.
17. **Hallmark Floor 10.** Teks meta digabung titik tengah (stempel, badge Hadir, baris karyawan, footer login, bantuan dropzone). Perbaikan: pisah baris atau kalimat.

Tidak dijalankan: impeccable (butuh peluncur dan folder proyek, kode frontend hanya ada di chat), sloplint Hallmark, dan build.

---

## Bagian 3 (DESIGN.md)

## DESIGN.md: Absensi WFH

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1
Mode (impeccable): Operate. Karyawan menyelesaikan satu tugas harian, HRD memindai tabel.

### Alasan keputusan (satu baris per keputusan)

- **Latar krem hangat `#F7F5F0`, kartu putih:** dari brief; krem mengurangi silau saat dipakai tiap hari, putih memisahkan area yang dikerjakan.
- **Aksen biru tinta `#1E4D8C` (teks di atas latar lembut: `#17396B`):** aksen dipakai hanya pada aksi utama, menu aktif, dan stempel. Sebelumnya terrakota; diganti karena terlalu mirip tampilan Claude. Untuk mengembalikan: `--color-accent: 176 74 34`, `--color-accent-soft: 246 231 223`, `--color-accent-ink: 154 63 27`.
- **Hijau sage `#2F6F5E`:** hanya untuk status hadir, agar makna warna tidak tumpang tindih dengan aksen.
- **Merah `#A12B2B`:** hanya untuk error dan nonaktif.
- **Fraunces untuk judul dan jam besar, DM Sans untuk isi:** dari brief; serif memberi suara editorial pada dua tempat saja, isi tetap mudah dipindai.
- **Ikon Lucide:** dari brief; satu set konsisten, tipis, dan terbaca di ukuran kecil pada tabel padat.
- **Bento grid di halaman absensi:** dari brief; keempat blok (jam, profil, absen, riwayat) memang isi yang berbeda. Hierarki: jam tanpa bingkai, kartu absen paling besar.
- **Label tabel dan stempel memakai sentence case tanpa tracking:** huruf kapital berjarak lebar terlihat seperti templat dan lebih sulit dibaca dalam bahasa Indonesia.
- **Motif identitas = stempel:** muncul di pratinjau foto ("Pratinjau") dan di absen yang sudah tercatat ("Tercatat"). Satu gestur khas yang juga informatif.
- **Tanpa bayangan, tanpa blur, border 1px:** pemisahan lewat garis agar tabel tetap tenang dan terbaca.
- **Satu tema terang:** brief menetapkan satu palet. Mode gelap belum dibuat; token sudah berupa CSS variable sehingga bisa ditambahkan.
- **Gerak minimal:** hanya transisi warna. Stempel statis. Animasi hanya jika dial MOTION dinaikkan.
