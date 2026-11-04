# Audit Status Pekerjaan Fase 5.5

Waktu audit: 2026-11-04T13:50:00+07:00  
Cabang git: `refactor/microservices`

---

## 1. Tabel Status Audit 8 Butir Utama

| No | Butir | (a) Backend (Ada/Tidak, Path & Endpoint/RPC) | (b) Frontend (Ada/Tidak/Sebagian, Path) | (c) Catatan & Bukti Kode |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Pengaturan absensi** (`attendance_settings`, GET & PATCH `/settings`, tab navigasi HRD) | **Ada**<br>• Entity: `backend/apps/attendance-service/src/attendances/entities/attendance-settings.entity.ts`<br>• RPC: `attendances.getSettings`, `attendances.updateSettings`<br>• Endpoint: `GET /api/attendances/settings`, `PATCH /api/attendances/settings` di `backend/apps/api-gateway/src/attendances/attendances.controller.ts` | **Ada**<br>• Tab HRD: `frontend/src/layouts/AppShell.tsx` (baris 28–32)<br>• Halaman form: `frontend/src/pages/hrd/AttendanceSettingsPage.tsx`<br>• Hook & Client: `frontend/src/hooks/useAttendanceSettings.ts` & `frontend/src/api/attendance.ts` | Tabel singleton `attendance_settings` (`id = 1`) diinisialisasi otomatis saat `onModuleInit` dengan nilai default (08:30 WIB, toleransi 15 mnt, batas absen 17:00 WIB, Senin–Jumat). Form HRD memiliki validasi toleransi 0–120 menit dan selector hari kerja. |
| **2** | **Status terlambat** (`status`, `late_minutes`, hitung saat absen, badge karyawan & monitoring) | **Ada**<br>• Entity: `backend/apps/attendance-service/src/attendances/entities/attendance.entity.ts` (`status`, `lateMinutes`)<br>• Kalkulasi: di `attendances.service.ts` method `create()` menghitung selisih menit terhadap batas jam kerja + toleransi. | **Ada**<br>• Badge: `frontend/src/components/AttendanceStatusBadge.tsx`<br>• Halaman Karyawan: `frontend/src/pages/employee/AttendancePage.tsx`<br>• Tabel Monitoring: `frontend/src/pages/hrd/MonitoringPage.tsx` (kolom Status baris 119–126) | Status `ON_TIME` dan `LATE` beserta `lateMinutes` sudah di-render dengan badge warna ink/muted dan soft red di halaman karyawan dan kolom "Status" tabel HRD. |
| **3** | **Info batas jam masuk & penguncian tombol** di luar jam yang diizinkan | **Ada**<br>• Validasi: `attendances.service.ts` method `create()` memvalidasi hari kerja dan rentang jam masuk (menolak dengan RpcException / 400 jika di luar rentang). | **Ada**<br>• Banner & kalkulator: `frontend/src/components/CheckInWindowInfo.tsx` & `frontend/src/lib/attendanceRules.ts`<br>• Penguncian tombol: `frontend/src/pages/employee/AttendancePage.tsx` (`disabled={!canSubmit}`) | Tombol absen terkunci dengan pesan alasan jika di luar rentang waktu kerja atau di luar hari kerja yang diatur HRD. Validasi ganda ada di sisi frontend dan backend. |
| **4** | **Kartu ringkasan monitoring** (`GET /api/attendances/summary`, 4 kartu & panel "Belum absen hari ini") | **Ada**<br>• Endpoint: `GET /api/attendances/summary` di `apps/api-gateway/src/attendances/attendances.controller.ts`<br>• RPC: `employees.findActiveStaff` (employee-service) & `attendances.getDailyStats` (attendance-service). | **Tidak Ada**<br>• Belum dipanggil dan belum ada kartu/panel di `frontend/src/pages/hrd/MonitoringPage.tsx` | Backend sudah siap mengembalikan `{ date, totalEmployees, presentCount, onTimeCount, lateCount, absentCount, absentEmployees }`, tetapi frontend halaman monitoring belum memanggil API ini dan belum menampilkan 4 kartu statistik maupun panel daftar karyawan yang belum absen. |
| **5** | **Filter status di tabel monitoring** (Semua / Tepat waktu / Terlambat) | **Ada**<br>• DTO: `QueryAttendancesDto` (`status?: AttendanceStatus`) di `apps/api-gateway/src/attendances/dto/query-attendances.dto.ts`<br>• Query: `attendances.service.ts` method `findAll()`. | **Tidak Ada**<br>• `frontend/src/pages/hrd/MonitoringPage.tsx` hanya memiliki filter `dateFrom`, `dateTo`, dan `nameInput`. | Backend query builder sudah siap menerima query param `?status=ON_TIME` atau `?status=LATE`, tetapi UI belum menyediakan elemen `<select>` filter status tersebut. |
| **6** | **Export CSV** (`GET /api/attendances/export`, tombol "Ekspor CSV", header `Content-Disposition` & `X-Export-Truncated`) | **Ada**<br>• Endpoint: `GET /api/attendances/export` di `apps/api-gateway/src/attendances/attendances.controller.ts`<br>• CORS exposed headers di `apps/api-gateway/src/main.ts`. | **Tidak Ada**<br>• Belum ada tombol "Ekspor CSV" dan fungsi trigger download di `frontend/src/pages/hrd/MonitoringPage.tsx` | Backend sudah lengkap dengan sanitasi formula CSV, BOM `\uFEFF`, header `Content-Disposition`, dan deteksi limit 5000 (`X-Export-Truncated`), namun frontend belum menyediakan tombol dan penanganan unduhannya. |
| **7** | **Format jam `HH:mm:ss` dengan titik dua** di seluruh frontend | N/A (Frontend) | **Ada / Konsisten**<br>• Format fungsi: `frontend/src/lib/format.ts` (`formatTime`) & `frontend/src/lib/hrdFormat.ts` (`formatTimeWib`). | Seluruh tampilan jam absensi memakai locale `en-GB` dengan pemisah titik dua (`HH:mm:ss WIB`), misal di `LiveClock`, `AttendanceStamp`, riwayat karyawan, dan tabel HRD. Format `HH:mm` (tanpa detik) hanya dipakai untuk jam kerja di pengaturan/info batas jam masuk. Tidak ditemukan penggunaan pemisah titik (`.`). |
| **8** | **Docker** (Dockerfile & docker-compose.yml lengkap multi-service) | **Sebagian / Tidak Lengkap**<br>• Root `docker-compose.yml` masih menggunakan PostgreSQL (lama) dan monolit `backend` tunggal. | **Sebagian / Tidak Lengkap**<br>• Frontend ada di compose lama, namun konfigurasi microservices belum ada. | Database aktif proyek adalah **MySQL 8**, sedangkan `docker-compose.yml` lama masih mengarah ke PostgreSQL dan build monolit tunggal. Belum ada Dockerfile terpisah untuk 3 microservice (`api-gateway`, `employee-service`, `attendance-service`). |

---

## 2. Riwayat Git: 10 Commit Terakhir

```text
396da65 style(frontend): improve employee attendance layout with 16:9 photo, sticky right column, and monthly summary card
cdcb86d feat(frontend): implement Phase 5.5 Frontend-A attendance settings and late status
bca9fcb feat(backend): implement Phase 5.5B and 5.5C daily summary, status filter, and CSV export
96cb4a5 feat(backend): implement Phase 5.5A attendance settings and late status
9d2a877 feat(backend): implement Phase 5B attendance-service, photo storage, and gateway endpoints
3806a58 fix(employee-service): enable log in seeder and ensure demo password hash is populated
b3b0e51 feat(backend): implement Phase 5A microservices architecture with api-gateway and employee-service
588b020 feat(frontend): implement Phase 4 HRD master employees and attendance monitoring
157954b refactor(frontend): align Phase 3 with exact audit specification and mobile ordering
f338515 refactor(frontend): apply Phase 3 antislop audit and deep blue ink theme
```

---

## 3. Status File yang Belum Di-commit (`git status --short`)

```text
 M frontend/src/components/AttendanceStatusBadge.tsx
 M frontend/src/components/CheckInWindowInfo.tsx
 M frontend/src/hooks/useAttendanceSettings.ts
 M frontend/src/lib/attendanceRules.ts
 M frontend/src/pages/hrd/AttendanceSettingsPage.tsx
```
*(Catatan: kelima file di atas hanya berisi normalisasi baris baru CRLF di baris akhir).*

---

## 4. Ringkasan "Yang Belum Dikerjakan" (Berdasarkan Prioritas)

### Prioritas 1 — Frontend Monitoring HRD (`MonitoringPage.tsx`) (Fase 5.5-B & 5.5-C)
1. **4 Kartu Ringkasan & Panel "Belum Absen Hari Ini":**
   - Integrasi API `GET /api/attendances/summary?date=YYYY-MM-DD`.
   - Render 4 kartu ringkasan: Total Karyawan Aktif, Sudah Hadir, Tepat Waktu, dan Terlambat.
   - Render accordion / drawer / panel daftar nama dan NIK karyawan yang belum melakukan absen pada tanggal terpilih.
2. **Filter Status Kehadiran:**
   - Tambahkan dropdown `<select>` filter status (`Semua`, `Tepat Waktu`, `Terlambat`) pada bar filter monitoring.
   - Kirim parameter `?status=ON_TIME` atau `?status=LATE` ke `fetchAttendances`.
3. **Tombol "Ekspor CSV":**
   - Tambahkan tombol "Ekspor CSV" di atas tabel monitoring.
   - Request ke `GET /api/attendances/export` membawa filter aktif (`date_from`, `date_to`, `employee_name`, `status`).
   - Trigger download browser menggunakan Blob dengan nama file dari header `Content-Disposition`.
   - Baca header `X-Export-Truncated`: jika `true`, tampilkan peringatan bahwa data terpotong pada 5.000 baris.

### Prioritas 2 — Docker & Containerization Multi-Service
1. Buat `Dockerfile` untuk masing-masing container:
   - `backend/apps/api-gateway/Dockerfile`
   - `backend/apps/employee-service/Dockerfile`
   - `backend/apps/attendance-service/Dockerfile`
   - `frontend/Dockerfile`
2. Perbarui `docker-compose.yml` di root proyek:
   - Ganti engine PostgreSQL lama dengan **MySQL 8**.
   - Definisikan networking dan environment variable antarlayanan (TCP RabbitMQ/Redis/TCP Port internal microservices, credentials database MySQL).

### Prioritas 3 — Peningkatan Fitur & Pencegahan Kecurangan (Optional Enhancement)
1. **Kamera Langsung via `getUserMedia` (Frontend):**
   - Ambil foto langsung dari kamera depan dengan tombol jepret, ulangi, dan render canvas ke JPEG.
   - Fallback otomatis ke upload file biasa jika kamera tidak tersedia atau izin ditolak.
2. **Anti-Fraud Hash SHA-256 Foto (Backend):**
   - Hitung SHA-256 buffer foto di API Gateway saat submit absen.
   - Simpan ke kolom baru `photo_hash` di tabel `attendances` (berindeks).
   - Validasi keunikan hash: tolak jika foto yang sama pernah digunakan oleh karyawan mana pun sebelumnya.

