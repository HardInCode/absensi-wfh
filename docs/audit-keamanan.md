# Laporan Audit Keamanan Sistem Absensi WFH

**Tanggal Audit:** 5 November 2026  
**Ruang Lingkup:** Kode sumber `backend` (api-gateway, employee-service, attendance-service, common) dan `frontend` (React + Vite).  
**Metodologi:** Analisis kode statis (*Static Application Security Testing*), penelusuran kontrol akses (RBAC/Guard tracing), audit konfigurasi, dan audit dependensi paket (`npm audit`).

---

## 1. Ringkasan Eksekutif (10 Baris)

1. Arsitektur isolasi jaringan backend sangat baik: port TCP internal employee & attendance service hanya bind ke `127.0.0.1`.
2. Gateway menjadi satu-satunya gerbang publik dan telah mengimplementasikan autentikasi JWT (`JwtAuthGuard`) serta otorisasi berbasis peran (`RolesGuard`) secara global.
3. Hak akses streaming bukti foto (`GET /attendances/:id/photo`) aman dan memverifikasi kepemilikan data (hanya pemilik atau ADMIN_HRD yang diizinkan).
4. Penanganan berkas bukti foto aman dari path traversal, memvalidasi magic bytes buffer, mengacak nama berkas dengan UUID, dan tidak disajikan secara statis.
5. Kueri database sepenuhnya memakai parameterisasi dan fungsi escape wildcard LIKE, mencegah SQL Injection.
6. Fitur ekspor CSV telah menerapkan mitigasi formula injection (`sanitizeCsvText`) untuk karakter `=`, `+`, `-`, `@`, `\t`, `\r` serta escape RFC 4180.
7. Temuan berisiko tinggi adalah ketiadaan proteksi laju request (*rate limiting*) pada endpoint login dan upload foto.
8. Temuan berisiko sedang mencakup belum adanya proteksi backend terhadap admin yang mendemosi atau menonaktifkan akunnya sendiri (*self-lockout*).
9. Nilai placeholder `JWT_SECRET` pada `.env.example` sudah melebihi 32 karakter sehingga berisiko lolos validasi jika disalin mentah-mentah ke produksi.
10. Secara keseluruhan postur keamanan aplikasi solid pada level logika bisnis, dengan rekomendasi perbaikan terfokus pada penguatan pertahanan perimeter (*rate limiting* dan *hardening*).

---

## 2. Tabel Temuan Keamanan (Terurut Berdasarkan Risiko)

| No | Kategori | Temuan | Risiko | Lokasi Kode | Bukti / Mekanisme |
|---|---|---|---|---|---|
| 1 | Konfigurasi | Ketiadaan Rate Limiting / Brute-force Protection | **Tinggi** | `backend/apps/api-gateway/src/main.ts`, `backend/package.json` | Tidak ditemukan dependensi `@nestjs/throttler` atau middleware throttling. Endpoint `POST /api/auth/login` dapat dibrute-force tanpa batas, dan `POST /api/attendances` dapat dibanjiri upload berkas. |
| 2 | Otorisasi | Proteksi Self-Modification & Last-Admin Lockout Hanya di Frontend | **Sedang** | `backend/apps/api-gateway/src/employees/employees.controller.ts:54-67`, `backend/apps/employee-service/src/employees/employees.service.ts:101-131` | Endpoint `PATCH /api/employees/:id` dan `DELETE /api/employees/:id` tidak memeriksa `@CurrentUser()`. Admin dapat mengubah role-nya sendiri menjadi `EMPLOYEE` atau `isActive: false` lewat API langsung. |
| 3 | Rahasia & Konfigurasi | Placeholder JWT Secret Default Lolos Validasi `@MinLength(32)` | **Sedang** | `backend/.env.example:29`, `backend/libs/common/src/config/env.validation.ts:32` | Placeholder `ganti-dengan-string-acak-minimal-32-karakter-ya` memiliki panjang 47 karakter. Jika disalin ke `.env` tanpa diubah, server tetap start normal dan token dapat dipalsukan pihak luar. |
| 4 | Validasi Data | `forbidNonWhitelisted` Belum Diaktifkan pada ValidationPipe | **Rendah** | `backend/apps/api-gateway/src/main.ts:20` | `ValidationPipe({ whitelist: true, transform: true })`. Properti liar di-strip diam-diam tanpa melempar 400 Bad Request jika ada muatan yang tidak diharapkan. |
| 5 | Konfigurasi | Swagger UI Terbuka di Semua Lingkungan | **Rendah** | `backend/apps/api-gateway/src/main.ts:23-34` | Rute `/api/docs` diinisialisasi tanpa memeriksa `NODE_ENV !== 'production'`. Di lingkungan produksi publik, ini mengekspos struktur skema dan endpoint. |
| 6 | Frontend | Penyimpanan JWT di `localStorage` | **Rendah** | `frontend/src/lib/api.ts:3`, `frontend/src/auth/AuthContext.tsx:64` | `localStorage.setItem("absensi.token", token)`. Token rentan diekstraksi jika terjadi XSS via third-party dependency (meskipun saat ini tidak ada XSS langsung). |
| 7 | Dependensi | Kerentanan Dependensi Transitive (`tar`, `vite`) | **Rendah** | `backend/package.json` (`bcrypt` -> `tar <=7.5.20`), `frontend/package.json` (`vite <=6.4.3`) | Hasil `npm audit` mendeteksi 1 kerentanan kritis (`tar` CVE pada tool build/pre-gyp) dan 1 high (`vite` launch-editor). Mayoritas berdampak pada build time, bukan runtime API. |

---

## 3. Tabel Pemetaan Endpoint vs Role (Aktual vs README)

Guard global: `JwtAuthGuard` (semua rute butuh token Bearer kecuali bertanda `@Public()`), dilanjutkan `RolesGuard` (memeriksa `@Roles()`).

| Method | Endpoint | Role Aktual di Kode | Role di README | Status | Bukti Kode |
|---|---|---|---|---|---|
| GET | `/api/time` | **Publik** | Publik | **AMAN** | `time.controller.ts:9` (`@Public()`) |
| POST | `/api/auth/login` | **Publik** | Publik | **AMAN** | `auth.controller.ts:23` (`@Public()`) |
| GET | `/api/auth/me` | **Semua User Login** | Semua user login | **AMAN** | `auth.controller.ts:32` (tanpa `@Public()`, tanpa `@Roles`) |
| GET | `/api/employees` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `employees.controller.ts:31` (`@Roles(Role.ADMIN_HRD)` class-level) |
| POST | `/api/employees` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `employees.controller.ts:31` |
| GET | `/api/employees/:id` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `employees.controller.ts:31` |
| PATCH | `/api/employees/:id` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `employees.controller.ts:31` |
| DELETE | `/api/employees/:id` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `employees.controller.ts:31` |
| POST | `/api/attendances` | **EMPLOYEE** | EMPLOYEE | **AMAN** | `attendances.controller.ts:54` (`@Roles(Role.EMPLOYEE)`) |
| GET | `/api/attendances/today` | **EMPLOYEE** | EMPLOYEE | **AMAN** | `attendances.controller.ts:82` (`@Roles(Role.EMPLOYEE)`) |
| GET | `/api/attendances/my` & `/me` | **EMPLOYEE** | EMPLOYEE | **AMAN** | `attendances.controller.ts:89` (`@Roles(Role.EMPLOYEE)`) |
| GET | `/api/attendances/settings` | **Semua User Login** | Semua user login | **AMAN** | `attendances.controller.ts:96` (tanpa `@Roles`) |
| PATCH | `/api/attendances/settings` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `attendances.controller.ts:103` (`@Roles(Role.ADMIN_HRD)`) |
| GET | `/api/attendances/summary` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `attendances.controller.ts:110` (`@Roles(Role.ADMIN_HRD)`) |
| GET | `/api/attendances/export` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `attendances.controller.ts:117` (`@Roles(Role.ADMIN_HRD)`) |
| GET | `/api/attendances` | **ADMIN_HRD** | ADMIN_HRD | **AMAN** | `attendances.controller.ts:139` (`@Roles(Role.ADMIN_HRD)`) |
| GET | `/api/attendances/:id/photo` | **Semua User Login** (diperiksa internal: pemilik / HRD) | Pemilik atau ADMIN_HRD | **AMAN** | `attendances.controller.ts:145` & `attendances.service.ts:300` |

*Hasil evaluasi:* 100% konsisten antara dokumentasi README dan implementasi kode.

---

## 4. Evaluasi Lengkap 16 Butir Audit

### Butir 1: Autentikasi dan Otorisasi Tiap Endpoint Gateway
- **Status:** **AMAN**
- **Bukti:** `backend/apps/api-gateway/src/auth/auth.module.ts:15-16` mendaftarkan `JwtAuthGuard` dan `RolesGuard` sebagai `APP_GUARD`. Tiap controller terlindungi secara default kecuali diberi anotasi `@Public()`. Seluruh endpoint sensitif HRD memiliki `@Roles(Role.ADMIN_HRD)` dan endpoint absensi memiliki `@Roles(Role.EMPLOYEE)`.
- **Risiko:** -
- **Saran:** Pertahankan arsitektur guard global ini.

---

### Butir 2: Otorisasi Akses Bukti Foto (`GET /attendances/:id/photo`)
- **Status:** **AMAN**
- **Bukti:** `backend/apps/api-gateway/src/attendances/attendances.service.ts:299-302`:
  ```ts
  const record = await this.attendances.findOne(id);
  if (user.role !== Role.ADMIN_HRD && record.employeeId !== user.id) {
    throw new ForbiddenException('You are not allowed to view this photo');
  }
  ```
  Jika Karyawan A mencoba mengakses foto milik Karyawan B (`record.employeeId === B.id` dan `user.id === A.id`), kondisi bernilai `true && true` dan melempar `ForbiddenException` (HTTP 403). Akses hanya terbuka jika `user.role === Role.ADMIN_HRD` atau `record.employeeId === user.id`.
- **Risiko:** -
- **Saran:** Sudah aman.

---

### Butir 3: Potensi Eskalasi Hak Akses dan Self-Modification
- **Status:** **TEMUAN**
- **Bukti:** 
  1. *Eskalasi EMPLOYEE ke endpoint HRD:* AMAN. Ditolak oleh `RolesGuard` (HTTP 403).
  2. *Mass assignment role:* EMPLOYEE tidak bisa mengubah role karena tidak punya akses ke `PATCH /api/employees/:id`.
  3. *Self-modification:* TEMUAN. Di `backend/apps/api-gateway/src/employees/employees.controller.ts:54-67`, handler `update` dan `remove` tidak menerima token pengguna (`@CurrentUser()`). Admin HRD dapat memanggil `PATCH /api/employees/<id-sendiri>` dengan body `{"role": "EMPLOYEE"}` atau `DELETE /api/employees/<id-sendiri>`. Proteksi pencegahan demosi/nonaktif akun sendiri baru diterapkan di sisi frontend (`EmployeesPage.tsx:96`), belum ditegakkan di backend.
- **Risiko:** **Sedang**
- **Saran:** Tambahkan validasi di `EmployeesController` atau `employee-service`: jika `targetEmployeeId === currentUserId`, tolak pengubahan `role` dan `isActive: false` (HTTP 400/403). Pastikan juga minimal tersisa 1 akun ADMIN_HRD aktif di sistem.

---

### Butir 4: Manajemen Token JWT
- **Status:** **AMAN**
- **Bukti:**
  1. *Secret & Algoritma:* Dibaca dari environment `JWT_SECRET` (`MinLength(32)` pada validator). Pada `backend/apps/api-gateway/src/auth/strategies/jwt.strategy.ts:18`, algoritma dikunci secara eksplisit ke `algorithms: ['HS256']` (mencegah *algorithm confusion attack*).
  2. *Masa berlaku:* `ignoreExpiration: false`, durasi 8 jam (`JWT_EXPIRES_IN_SECONDS=28800`).
  3. *Token akun nonaktif:* `jwt.strategy.ts:23-25` memanggil `this.employees.validateUser(payload.sub)`. Di `backend/apps/employee-service/src/auth/auth.service.ts:59-61`:
     ```ts
     const e = await this.employees.findEntityOrNull(id);
     if (!e || !e.isActive) throw new UnauthorizedException('Unauthorized');
     ```
     Setiap request ber-token memvalidasi status keaktifan akun secara real-time. Jika akun dinonaktifkan, token lama **seketika ditolak** (HTTP 401).
- **Risiko:** -
- **Saran:** Sudah sangat baik.

---

### Butir 5: Keamanan Proses Login
- **Status:** **AMAN**
- **Bukti:** `backend/apps/employee-service/src/auth/auth.service.ts:28-40`:
  1. *Password hashing:* Menggunakan `bcrypt.compare` dengan cost factor konfigurasi (`BCRYPT_ROUNDS=10`).
  2. *Pencegahan Account Enumeration:* Menggunakan `dummyHash` jika email tidak ditemukan di database, sehingga waktu eksekusi `bcrypt.compare` identik baik akun ada maupun tidak (mitigasi *timing attack*). Pesan galat disamarkan menjadi `UnauthorizedException('Invalid credentials')` (HTTP 401).
  3. *Akun nonaktif:* `if (!employee.isActive) throw new ForbiddenException('Account is inactive')` dievaluasi **setelah** verifikasi password sukses, sehingga status nonaktif tidak membocorkan keberadaan akun kepada penyerang yang menebak-nebak password.
- **Risiko:** -
- **Saran:** Sudah sesuai *best practice*.

---

### Butir 6: Validasi Upload dan Penanganan Berkas
- **Status:** **AMAN**
- **Bukti:**
  1. *Batas Ukuran:* Dibatasi 3 MB di Multer (`limits: { fileSize: 3 * 1024 * 1024 }` di `attendances.controller.ts:70`).
  2. *Magic Bytes:* Diuji langsung terhadap buffer mentah di `backend/apps/api-gateway/src/attendances/utils/image-type.util.ts:14-29` (JPEG `FF D8 FF`, PNG 8-byte signature, WebP `RIFF...WEBP`). Ekstensi palsu (misal `.php` atau `.exe` yang di-rename) ditolak.
  3. *Nama Berkas & Path Traversal:* Nama file dari klien dibuang total. Disimpan ulang menggunakan `randomUUID().ext` (`photo-storage.service.ts:24`). Saat pembacaan, `path.basename` dan `full.startsWith(this.dir + path.sep)` memastikan tidak ada *directory traversal*.
  4. *Penyajian Statis:* Direktori `uploads/` **TIDAK** disajikan statis (`ServeStaticModule` tidak digunakan). Foto hanya bisa diakses via stream biner terproteksi token.
  5. *Rollback File:* Jika terjadi kegagalan RPC atau duplikat hash, file fisik langsung dihapus via `fs.unlink`.
- **Risiko:** -
- **Saran:** Sudah memenuhi standar keamanan upload berkas modern.

---

### Butir 7: Parameterisasi Kueri & Escape Wildcard SQL
- **Status:** **AMAN**
- **Bukti:**
  1. *Kueri Pencarian:* `backend/apps/employee-service/src/employees/employees.service.ts:22-72` menggunakan helper:
     ```ts
     const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
     ```
     Karakter khusus wildcard SQL (`%`, `_`, `\`) dinetralkan sebelum dimasukkan ke parameter `:like`.
  2. *Parameter Kueri:* Semua klausa (`LIKE :like`, `role = :role`, `isActive = :isActive`, `employeeId IN (:...ids)`) menggunakan parameter terikat TypeORM. Tidak ada penggabungan string mentah (*string concatenation*) pada kueri SQL.
- **Risiko:** -
- **Saran:** Pertahankan pola escape dan parameter binding ini.

---

### Butir 8: Konfigurasi Validasi DTO
- **Status:** **TEMUAN**
- **Bukti:**
  1. `backend/apps/api-gateway/src/main.ts:20`:
     ```ts
     app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
     ```
     `whitelist: true` sudah membuang properti yang tidak ada di DTO, mencegah *mass assignment*.
  2. Batasan panjang string dan format telah didefinisikan: `@MaxLength`, `@MinLength`, format tanggal regex `DATE_RE = /^\d{4}-\d{2}-\d{2}$/`, regex jam `HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/`, dan pagination `@Min(1) @Max(100)`.
  3. Namun, opsi `forbidNonWhitelisted: true` belum diaktifkan, sehingga pengiriman payload liar diabaikan tanpa peringatan/penolakan HTTP 400.
- **Risiko:** **Rendah**
- **Saran:** Tambahkan `forbidNonWhitelisted: true` pada `ValidationPipe` di `api-gateway/src/main.ts` agar API bersifat *fail-closed* terhadap properti yang tidak dikenal.

---

### Butir 9: Sanitasi Formula Injection & Format CSV Export
- **Status:** **AMAN**
- **Bukti:** `backend/apps/api-gateway/src/attendances/utils/csv.util.ts:2-16`:
  ```ts
  const FORMULA_START = /^[=+\-@\t\r]/;
  export function sanitizeCsvText(value: string | null | undefined): string {
    const s = value ?? '';
    return FORMULA_START.test(s) ? `'${s}` : s;
  }
  ```
  Karakter berbahaya yang berpotensi memicu eksekusi macro/rumus di Excel/Sheets (`=`, `+`, `-`, `@`, tab, carriage return) otomatis dinetralkan dengan prefiks apostrof `'`. Nilai yang memuat koma, kutip ganda, atau baris baru dibungkus tanda kutip ganda RFC 4180 dengan kutip di dalamnya digandakan (`""`). File diawali UTF-8 BOM (`\uFEFF`).
- **Risiko:** -
- **Saran:** Mekanisme sanitasi CSV sudah komprehensif.

---

### Butir 10: Konfigurasi Header Keamanan & Swagger
- **Status:** **TEMUAN**
- **Bukti:**
  1. *CORS:* `main.ts:14-19` dikonfigurasi ketat ke origin `FRONTEND_URL` dengan metode terbatas (`GET, POST, PATCH, DELETE, OPTIONS`).
  2. *Helmet:* `main.ts:13` mengaktifkan `helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })`.
  3. *Swagger:* `main.ts:23-34` mengaktifkan Swagger UI di `/api/docs` tanpa pengecekan environment. Di lingkungan produksi publik, Swagger mengekspos seluruh kontrak API dan struktur skema DTO.
- **Risiko:** **Rendah**
- **Saran:** Nonaktifkan Swagger di produksi dengan membungkusnya dalam kondisi `if (config.get('NODE_ENV') !== 'production')`.

---

### Butir 11: Isolasi Port TCP Microservice
- **Status:** **AMAN**
- **Bukti:**
  - `backend/apps/employee-service/src/main.ts:9`: `host = process.env.EMPLOYEE_SERVICE_HOST ?? '127.0.0.1';`
  - `backend/apps/attendance-service/src/main.ts:9`: `host = process.env.ATTENDANCE_SERVICE_HOST ?? '127.0.0.1';`
  Kedua service hanya mengikat (*bind*) ke antarmuka loopback `127.0.0.1` (port 3001 dan 3002). Port TCP internal tidak dapat dijangkau dari luar mesin, sehingga hanya gateway yang dapat berkomunikasi dengan microservice tersebut.
- **Risiko:** -
- **Saran:** Tetap pertahankan binding loopback pada lingkungan non-containerized, atau gunakan private docker network jika dikontainerisasi.

---

### Butir 12: Kebocoran Informasi (Stack Trace & Logging)
- **Status:** **AMAN**
- **Bukti:**
  1. `backend/libs/common/src/rpc/rpc-error.ts:51-54` menangkap exception yang tidak tertangani, mencatat stack trace ke logger lokal backend, dan hanya mengembalikan pesan generik `{ statusCode: 500, message: 'Internal server error' }` kepada klien gateway.
  2. Pemeriksaan logging (`git grep "logger\." backend/`): tidak ada log yang mencatat password mentah, password hash, atau token JWT. Log absensi hanya mencatat event operasional (seperti email user saat seed, timeout RPC, batas export, atau nama file yang gagal di-unlink).
- **Risiko:** -
- **Saran:** Sudah aman.

---

### Butir 13: Manajemen Rahasia & Riwayat Git
- **Status:** **TEMUAN**
- **Bukti:**
  1. *Riwayat Git:* Perintah `git log --all --oneline -- backend/.env .env frontend/.env` menghasilkan output kosong. Tidak pernah ada file `.env` yang ter-commit ke repositori git.
  2. *.gitignore:* Mendefinisikan aturan ketat untuk `.env`, `.env.local`, `.env.*.local`, `backend/.env`, dan `frontend/.env`.
  3. *Nilai Default di `.env.example`:* Nilai `JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter-ya` adalah string statis sepanjang 47 karakter. Karena melebihi 32 karakter, jika pengguna tidak sengaja menyalin file ini ke `.env` tanpa mengubah isinya, validator `MinLength(32)` tetap menganggapnya valid.
- **Risiko:** **Sedang**
- **Saran:** Tambahkan validasi eksplisit di `env.validation.ts` untuk menolak string placeholder bawaan (misal `!val.includes('ganti-dengan-string')`) saat aplikasi dijalankan di mode produksi.

---

### Butir 14: Pembatasan Laju Request (Rate Limiting)
- **Status:** **TEMUAN**
- **Bukti:**
  Pencarian dependensi throttling (`git grep -i "throttl" backend/`) tidak menemukan modul pembatas laju. `main.ts` dan controller tidak memiliki rate limiter.
  - Endpoint `POST /api/auth/login` rentan terhadap serangan *brute force* kata sandi dan *credential stuffing*.
  - Endpoint `POST /api/attendances` rentan terhadap banjir upload file yang dapat menguras resource CPU (hashing SHA-256) dan penyimpanan disk.
- **Risiko:** **Tinggi**
- **Saran:** Pasang `@nestjs/throttler` pada API Gateway. Terapkan ThrottlerGuard secara global dengan aturan khusus:
  - Rute login: maksimal 5 percobaan per menit per alamat IP.
  - Rute upload absensi: maksimal 10 request per menit per pengguna.

---

### Butir 15: Audit Dependensi Pihak Ketiga (`npm audit`)
- **Status:** **TEMUAN**
- **Bukti:**
  - `backend`: Total 33 kerentanan (1 kritis, 15 tinggi, 12 moderat, 5 rendah).
    - **Kritis:** Paket `tar` (<=7.5.20) via rantai dependensi `bcrypt -> @mapbox/node-pre-gyp -> tar` (GHSA-34x7-hfp2-rc4v: path traversal saat ekstraksi tar).
    - **Tinggi:** `@nestjs/core` (<=11.1.17 GHSA-36xv-jgw5-4q75), `body-parser` (<=1.20.8 GHSA-v422-hmwv-36x6 DoS limit bypass), serta beberapa dev-dependencies build tools (`glob`, `picomatch`, `tmp`).
  - `frontend`: Total 4 kerentanan (1 tinggi, 3 moderat).
    - **Tinggi:** Paket `vite` (<=6.4.3 GHSA-587h-7wmj-h5pm: bypass pengecekan `launch-editor` pada OS Windows).
- **Risiko:** **Rendah / Sedang** (Mayoritas kerentanan berada pada toolchain pengembangan dan build time; kerentanan `body-parser` di-mitigasi oleh batas Multer 3 MB).
- **Saran:** Jalankan evaluasi peremajaan paket dependensi:
  - Upgrade NestJS packages ke versi patch terbaru yang kompatibel.
  - Pertimbangkan `bcryptjs` murni atau upgrade versi `bcrypt` untuk memutus dependensi terhadap versi `tar` lama.
  - Perbarui Vite pada frontend ke versi terbaru yang telah menambal isu `launch-editor`.

---

### Butir 16: Keamanan Sisi Klien (Frontend)
- **Status:** **TEMUAN**
- **Bukti:**
  1. *XSS:* AMAN. Pencarian `dangerouslySetInnerHTML` di `frontend/src/` menghasilkan output kosong. Seluruh rendering catatan pengguna (`notes`) dan identitas karyawan menggunakan JSX binding standar (`{e.notes}`) yang otomatis di-escape oleh React Virtual DOM.
  2. *Penanganan 401:* AMAN. Interceptor Axios pada `frontend/src/lib/api.ts:24-27` otomatis menghapus token dari penyimpanan dan memicu event `AUTH_EXPIRED_EVENT` untuk meredirect pengguna kembali ke halaman login.
  3. *Batas Rute Frontend:* AMAN. Pembatasan rute di sisi klien (`ProtectedRoute`, `RoleRoute`) murni untuk kenyamanan UX; seluruh operasi data dan panggilan API tetap divalidasi dan diotorisasi di backend via JWT dan RBAC guard.
  4. *Penyimpanan Token:* TEMUAN. Token JWT disimpan pada `localStorage` (`absensi.token`). Jika aplikasi disusupi skrip pihak ketiga (XSS melalui dependensi), token di `localStorage` dapat dibaca oleh script attacker.
- **Risiko:** **Rendah**
- **Saran:** Untuk sistem absensi dengan standar korporat tinggi, pertimbangkan migrasi penyimpanan token ke cookie `httpOnly`, `Secure`, dan `SameSite=Strict`.

---

## 5. Rencana Perbaikan yang Disarankan

Daftar rekomendasi diurutkan berdasarkan kombinasi **dampak keamanan tertinggi** dan **kemudahan implementasi (effort terendah)**:

### Tahap 1: *Quick Wins* (Dampak Signifikan, Usaha Sangat Rendah)
1. **Tambahkan Rate Limiting pada Endpoint Login & Absensi (Butir 14 - Risiko Tinggi)**
   - Pasang paket `@nestjs/throttler` di API Gateway.
   - Konfigurasikan throttler global (misal 60 req/menit) dan berikan decorator `@Throttle({ default: { limit: 5, ttl: 60000 } })` pada `POST /api/auth/login`.
   - *Estimasi usaha:* 15-30 menit.
2. **Aktifkan `forbidNonWhitelisted` pada ValidationPipe (Butir 8 - Risiko Rendah)**
   - Di `backend/apps/api-gateway/src/main.ts:20`, ubah menjadi:
     ```ts
     app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
     ```
   - *Estimasi usaha:* 2 menit.
3. **Kondisikan Swagger UI hanya untuk Mode Non-Produksi (Butir 10 - Risiko Rendah)**
   - Di `backend/apps/api-gateway/src/main.ts:23`, bungkus setup Swagger dalam:
     ```ts
     if (config.get('NODE_ENV') !== 'production') {
       SwaggerModule.setup('api/docs', app, document, ...);
     }
     ```
   - *Estimasi usaha:* 5 menit.
4. **Validasi Anti-Placeholder pada `JWT_SECRET` (Butir 13 - Risiko Sedang)**
   - Tambahkan pengecekan pada `validateGatewayEnv` dan `validateEmployeeEnv`: jika `JWT_SECRET` sama dengan nilai default `.env.example` dan `NODE_ENV === 'production'`, gagalkan proses startup.
   - *Estimasi usaha:* 10 menit.

### Tahap 2: *Logika Proteksi Backend* (Dampak Sedang, Usaha Rendah-Sedang)
5. **Cegah Self-Deactivation & Self-Demotion di Backend (Butir 3 - Risiko Sedang)**
   - Di `backend/apps/api-gateway/src/employees/employees.controller.ts`, injeksikan `@CurrentUser() user: AuthUser`.
   - Jika `id === user.id` dan request mencoba mengubah `role` atau `isActive: false`, lemparkan `BadRequestException('Tidak dapat mengubah peran atau menonaktifkan akun sendiri.')`.
   - Di service, tambahkan pengecekan agar sistem tidak bisa menghapus/menonaktifkan satu-satunya ADMIN_HRD yang tersisa.
   - *Estimasi usaha:* 30-45 menit.

### Tahap 3: *Maintenance & Arsitektur Jangka Menengah*
6. **Peremajaan Dependensi via `npm audit` (Butir 15 - Risiko Rendah)**
   - Uji pembaruan paket `@nestjs/*` ke patch rilis terbaru dan perbarui `vite` pada frontend.
   - *Estimasi usaha:* 1-2 jam (memerlukan uji regresi build).
7. **Penyimpanan Token berbasis HTTP-Only Cookie (Butir 16 - Risiko Rendah)**
   - Mengalihkan pengiriman token dari header Bearer ke cookie `httpOnly` dengan perlindungan CSRF.
   - *Estimasi usaha:* 2-4 jam (memerlukan penyesuaian Axios frontend dan CORS credentials).

