# Rangkuman Improvisasi Keamanan Sistem Absensi WFH

Dokumen ini merangkum seluruh pembaruan, penguatan (*hardening*), dan perbaikan keamanan yang telah diimplementasikan pada arsitektur microservices **Absensi WFH**.

---

## 1. Latar Belakang & Tujuan

Berdasarkan hasil audit keamanan (*security audit*) pada Fase 6, sistem memiliki fondasi logika bisnis dan isolasi jaringan internal yang kuat (TCP internal hanya bind ke `127.0.0.1`). Namun, ditemukan beberapa area perimeter dan kontrol otorisasi yang memerlukan penguatan untuk mencegah:
1. Serangan *brute force* dan *credential stuffing* pada endpoint otentikasi.
2. *Denial-of-Service* (DoS) dan pengurasan resource penyimpanan melalui flooding upload berkas.
3. Potensi *lockout* administratif akibat admin yang mendemosi atau menonaktifkan akunnya sendiri secara tidak sengaja.
4. Kecurangan absensi melalui penggunaan foto bukti kehadiran yang sama secara berulang (*photo reuse fraud*).

---

## 2. Rincian Improvisasi Keamanan yang Diterapkan

### A. Rate Limiting & Perlindungan Brute-Force (API Gateway)

Dipasang menggunakan `@nestjs/throttler@^5.2.0` yang kompatibel penuh dengan NestJS 10.

1. **Strategi Batas Laju Berjenjang:**
   - **Batas Global Longgar (600 request / menit per IP):** Rata-rata 10 request/detik. Diterapkan agar halaman monitoring HRD yang memuat puluhan kartu statistik, ringkasan, dan *streaming* foto bukti terlindungi tidak mengalami *false positive* (HTTP 429).
   - **Batas Ketat Otentikasi (`POST /api/auth/login`):** Dibatasi maksimal **10 request per menit per IP** menggunakan decorator `@Throttle({ default: { limit: 10, ttl: 60000 } })`. Mencegah serangan tebak password massal.
   - **Batas Ketat Upload Absensi (`POST /api/attendances`):** Dibatasi maksimal **20 request per menit per IP**. Mencegah bot membanjiri server dengan komputasi SHA-256 dan penulisan berkas ke disk.
   - **Endpoint Bebas/Longgar:** `GET /api/time` (sinkronisasi jam digital) dan `GET /api/attendances/:id/photo` tidak dibatasi ketat sehingga tidak menghambat browsing monitoring HRD.

2. **Urutan Eksekusi Guard Global yang Aman:**
   Diatur pada `AuthModule` melalui provider `APP_GUARD`:
   1. **`CustomThrottlerGuard` (Pertama):** Memotong request yang melampaui kuota sebelum server membebani CPU dengan verifikasi kriptografi token JWT atau panggilan RPC service.
   2. **`JwtAuthGuard` (Kedua):** Memvalidasi Bearer JWT token (dilewati jika endpoint `@Public()`).
   3. **`RolesGuard` (Ketiga):** Memvalidasi hak akses RBAC (`ADMIN_HRD` / `EMPLOYEE`).

3. **Format Respons Error Standar (HTTP 429):**
   Dengan meng-override method `throwThrottlingException`, format error 429 selaras dengan standar respon sistem dalam Bahasa Indonesia:
   ```json
   {
     "statusCode": 429,
     "message": "Terlalu banyak permintaan. Silakan tunggu beberapa saat lagi.",
     "error": "Too Many Requests"
   }
   ```

---

### B. Proteksi Self-Modification & Last-Admin Lockout

Mencegah situasi di mana admin secara tidak sengaja atau sengaja merusak hierarki administratif sistem.

1. **Validasi Akun Sendiri di API Gateway (`employees.controller.ts`):**
   - Mengambil data user yang sedang login via `@CurrentUser() user: AuthUser`.
   - Jika `id === user.id`:
     - Menolak perubahan `role` ke selain `ADMIN_HRD` (HTTP 400).
     - Menolak pengubahan status ke nonaktif (`isActive: false`) (HTTP 400).
     - Menolak permintaan hapus akun via `DELETE /api/employees/:id` (HTTP 400).
     - Pesan error: `"Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri."`
   - *Pengecualian yang sah:* Admin tetap diperbolehkan memperbarui field profil lainnya pada akun sendiri (nama lengkap, jabatan, dan kata sandi).

2. **Perlindungan Admin Terakhir di Employee Service (`employees.service.ts`):**
   - Menambahkan pengecekan `assertNotLastActiveAdmin(id)`.
   - Sebelum memproses demosi role, penonaktifan (`isActive: false`), atau penghapusan via `remove(id)` terhadap akun `ADMIN_HRD` aktif, sistem menghitung sisa Admin HRD aktif lainnya di database:
     ```ts
     const otherActiveAdmins = await this.repo
       .createQueryBuilder('e')
       .where('e.role = :role', { role: Role.ADMIN_HRD })
       .andWhere('e.isActive = :isActive', { isActive: true })
       .andWhere('e.id != :id', { id })
       .getCount();

     if (otherActiveAdmins === 0) {
       throw new BadRequestException('Minimal harus ada satu Admin HRD aktif.');
     }
     ```
   - Menjamin sistem tidak akan pernah kehilangan akses administratif.

---

### C. Anti-Fraud Bukti Foto & Integritas File (Fase 5.6)

1. **Hashing SHA-256 Otomatis:**
   - Gateway menghitung *fingerprint* SHA-256 langsung dari buffer biner foto sebelum dipersistensikan.
2. **Pencegahan Foto Duplikat Global:**
   - `attendance-service` memvalidasi `photo_hash` terhadap seluruh riwayat absensi di database. Jika hash yang sama ditemukan, request ditolak dengan HTTP 400: `"Foto ini sudah pernah digunakan. Ambil foto baru."`.
3. **Rollback Otomatis File Fisik:**
   - Jika RPC gagal, koneksi database terputus, atau terjadi konflik/duplikat, gateway seketika menghapus berkas fisik yang sempat tersimpan di `uploads/`, mencegah berkas yatim (*orphan files*).
4. **Proteksi Streaming Bukti Foto:**
   - Berkas di `uploads/` tidak disajikan secara statis.
   - Endpoint `GET /api/attendances/:id/photo` memverifikasi token dan hak kepemilikan data (hanya pemilik absen atau `ADMIN_HRD` yang diizinkan mengunduh/melihat foto).
   - Jalur pembacaan menerapkan `path.basename` dan verifikasi direktori untuk mencegah *path traversal*.

---

### D. Parameterisasi Kueri & Mitigasi Injeksi

1. **Pencegahan SQL Injection:**
   - Seluruh kueri TypeORM menggunakan *bound parameters* (`:like`, `:role`, `:ids`, dll.).
   - Input pencarian teks disaring dengan fungsi `escapeLike` yang menetralkan karakter wildcard SQL (`%`, `_`, `\`).
2. **Mitigasi CSV Formula Injection:**
   - Pada fitur ekspor CSV HRD, fungsi `sanitizeCsvText` memeriksa seluruh sel teks.
   - Sel yang diawali karakter eksekusi formula spreadsheet (`=`, `+`, `-`, `@`, `\t`, `\r`) otomatis diawali dengan apostrof `'` agar diperlakukan sebagai teks biasa, bukan formula yang dapat dieksekusi.
   - Penggunaan tanda kutip ganda RFC 4180 dan awalan UTF-8 BOM (`\uFEFF`).

---

## 3. Matriks Berkas yang Dimodifikasi

| Komponen | Berkas | Perubahan Keamanan |
|---|---|---|
| **API Gateway** | `src/common/guards/custom-throttler.guard.ts` | Guard kustom pembatas laju dengan format respons error 429 standar Bahasa Indonesia. |
| **API Gateway** | `src/api-gateway.module.ts` | Mendaftarkan `ThrottlerModule.forRoot` dengan limit global 600 req/menit per IP. |
| **API Gateway** | `src/auth/auth.module.ts` | Mendaftarkan `CustomThrottlerGuard` di urutan pertama sebelum `JwtAuthGuard` dan `RolesGuard`. |
| **API Gateway** | `src/auth/auth.controller.ts` | Menerapkan `@Throttle({ default: { limit: 10, ttl: 60000 } })` pada `POST /auth/login`. |
| **API Gateway** | `src/attendances/attendances.controller.ts` | Menerapkan `@Throttle({ default: { limit: 20, ttl: 60000 } })` pada `POST /attendances`. |
| **API Gateway** | `src/employees/employees.controller.ts` | Memvalidasi `@CurrentUser()` untuk menolak self-demote, self-deactivate, dan self-delete (HTTP 400). |
| **Employee Service** | `src/employees/employees.service.ts` | Menambahkan `assertNotLastActiveAdmin` untuk mencegah sistem kehilangan Admin HRD aktif terakhir (HTTP 400). |
| **Dokumentasi** | `README.md` | Memperbarui daftar batasan dan rincian rate limiting serta status audit dependensi. |

---

## 4. Rangkuman Skenario Pengujian Verifikasi

| Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status |
|---|---|---|---|
| **Brute-Force Login** | Kirim 11 kali login salah beruntun dalam 1 menit ke `POST /auth/login`. | Percobaan 1-10: HTTP 401.<br>Percobaan ke-11: HTTP 429 (`Terlalu banyak permintaan...`). | Terverifikasi |
| **Pemulihan Rate Limit** | Tunggu 60 detik setelah terkena 429, lalu kirim login dengan kredensial benar. | HTTP 200 OK, token JWT baru diterbitkan. | Terverifikasi |
| **Monitoring Tahan 429** | Fetch paralel 10 foto bukti berturut-turut menggunakan token HRD. | Seluruh 10 request foto berhasil HTTP 200 (kuota global 600/menit). | Terverifikasi |
| **Self-Demotion Admin** | Admin memanggil `PATCH /employees/<id-sendiri>` dengan body `{"role":"EMPLOYEE"}`. | Ditolak HTTP 400 (`Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.`). | Terverifikasi |
| **Self-Deletion Admin** | Admin memanggil `DELETE /employees/<id-sendiri>`. | Ditolak HTTP 400 (`Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.`). | Terverifikasi |
| **Update Profil Sendiri** | Admin mengubah field `position` atau `fullName` pada akun sendiri. | HTTP 200 OK (pembaruan data profil yang sah diizinkan). | Terverifikasi |
| **Demosi Admin Lain** | Admin A mendemosi Admin B saat sistem memiliki minimal 2 admin aktif. | HTTP 200 OK (perubahan diizinkan karena masih ada admin aktif lain). | Terverifikasi |
| **Last-Admin Lockout** | Admin mencoba mendemosi/menonaktifkan satu-satunya admin aktif yang tersisa. | Ditolak HTTP 400 (`Minimal harus ada satu Admin HRD aktif.`). | Terverifikasi |
| **Foto Duplikat Absen** | Mengunggah foto yang sama persis dengan absensi yang sudah ada di database. | Ditolak HTTP 400 (`Foto ini sudah pernah digunakan. Ambil foto baru.`). File fisik di-rollback. | Terverifikasi |

---

## 5. Kesimpulan & Roadmap Pemeliharaan

Dengan diterapkannya **Fix Keamanan 1 (Rate Limiting)** dan **Fix Keamanan 2 (Proteksi Hak Akses Administratif)**, perimeter sistem kini terlindungi dari eksploitasi otomatis dan kesalahan konfigurasi operasional, tanpa mengorbankan performa maupun kenyamanan pengguna.

Untuk pengembangan jangka panjang di lingkungan *production*, roadmap penguatan mencakup:
1. Migrasi penyimpanan token frontend dari `localStorage` ke cookie `httpOnly` dengan atribut `SameSite=Strict` dan `Secure`.
2. Penonaktifan rute Swagger UI (`/api/docs`) saat `NODE_ENV === 'production'`.
3. Peremajaan berkala dependensi build toolchain (`tar`, `vite`) saat siklus rilis non-kritis berikutnya.

