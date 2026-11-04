
---

## Ringkasan Handoff Pengembangan: Fase Penyempurnaan Aplikasi Absensi WFH

### 1. Konteks Arsitektur Saat Ini

* **Pola Arsitektur:** NestJS Monorepo Microservices (Transport TCP) + React (Vite) Frontend + MySQL.


* **Komponen Aktif:**
* `apps/api-gateway` (HTTP `:3000`): Single entry point, RBAC (`ADMIN_HRD`, `EMPLOYEE`), validasi upload foto (*magic bytes*, batas 3 MB), dan orkestrasi lintas servis.
* `apps/employee-service` (TCP `127.0.0.1:3001`): Mengelola autentikasi JWT dan master data karyawan.


* `apps/attendance-service` (TCP `127.0.0.1:3002`): Mengelola pencatatan kehadiran WFH berbasis zona waktu `Asia/Jakarta` (WIB) dengan isolasi *database* (tanpa *foreign key* lintas domain).


* `libs/common`: Menyimpan DTO, Enums, utilitas waktu WIB, dan `AllRpcExceptionsFilter`.



---

### 2. Ruang Lingkup Fitur Baru (4 Deliverables Utama)

#### A. Menu Pengaturan Absensi (`Attendance Settings`) & Logika Keterlambatan

Menambahkan kapabilitas konfigurasi dinamis bagi Admin HRD untuk mengatur aturan jam kerja tanpa *hardcode*.

* **Database (`attendance-service`):**
* Buat tabel `attendance_settings` (Single-Row Configuration, `id = 1`, di-*seed* otomatis saat inisialisasi).
* Tambahkan kolom `status` (`ENUM('ON_TIME', 'LATE')`, *default* `'ON_TIME'`) dan `late_minutes` (`INT`, *default* `0`) pada tabel `attendances`.
* Struktur konfigurasi yang disimpan (bisa berupa kolom terpisah atau `JSON`):
* `earliestCheckIn`: `"06:00"` (Jam mulai diperbolehkan absen).
* `defaultCutoffTime`: `"09:00"` (Batas jam masuk global).
* `toleranceMinutes`: `15` (Masa toleransi keterlambatan dalam menit).
* `requireNoteWhenLate`: `true` (Wajib isi catatan jika absen melewati batas *cut-off* + toleransi).
* `workingDays`: `[1, 2, 3, 4, 5]` (Senin–Jumat).
* `customDayCutoff`: `{"5": "08:30"}` (*Override* jam masuk per hari, opsional).




* **Kontrak RPC & Endpoint:**
* `GET /api/attendances/settings` -> RPC `attendances.getSettings` (Role: `EMPLOYEE`, `ADMIN_HRD`).
* `PATCH /api/attendances/settings` -> RPC `attendances.updateSettings` (Role: `ADMIN_HRD`).


* **Aturan Validasi Saat Submit Absen (`POST /api/attendances`):**
1. Tolak absen (`400 Bad Request`) jika waktu server WIB saat ini masih di bawah `earliestCheckIn` atau hari ini tidak termasuk dalam `workingDays`.
2. Hitung batas efektif hari ini: `cutoffHariIni` (cek `customDayCutoff[dayOfWeek]`, jika tidak ada pakai `defaultCutoffTime`) ditambah `toleranceMinutes`.
3. Jika waktu server WIB > batas efektif, tetapkan `status = 'LATE'` dan hitung `late_minutes` (selisih dari jam *cut-off* dasar).
4. Jika `status === 'LATE'` dan `requireNoteWhenLate === true`, pastikan *field* `note` tidak kosong (`400 Bad Request` jika kosong).


* **Perubahan UI (Frontend React):**
* **Navbar HRD:** Tambahkan tab menu ke-3 bernama **Pengaturan absensi** di sebelah `Master karyawan` dan `Monitoring absensi` untuk mengubah parameter di atas.


* **Halaman Karyawan:** Tampilkan info batas jam masuk di bawah jam digital, kunci tombol kirim jika belum masuk jam `earliestCheckIn`, ubah *input* catatan menjadi wajib diisi jika waktu berjalan sudah melewati batas keterlambatan, dan tampilkan *badge* kuning/merah **Terlambat** beserta menit keterlambatan pada kartu status & riwayat.


* **Tabel Monitoring HRD:** Tambahkan kolom **Status** dengan *badge* hijau **Tepat Waktu** atau merah **Terlambat (+X mnt)**.





---

#### B. Summary Cards Harian di Dashboard Monitoring HRD

Menampilkan ringkasan eksekutif kehadiran hari ini di bagian atas halaman `Monitoring absensi`.

* **Orkestrasi di `api-gateway` (`GET /api/attendances/summary`):**
* Lakukan *parallel RPC call* (`Promise.all`) menggunakan tanggal hari ini (WIB) atau parameter `?date=YYYY-MM-DD`:
1. Panggil `employee-service` (`employees.countActive` atau ambil dari daftar aktif) -> mendapatkan `totalActiveEmployees`.


2. Panggil `attendance-service` (`attendances.getDailyStats`) -> mendapatkan `presentCount`, `onTimeCount`, dan `lateCount` khusus untuk ID karyawan yang aktif.


* Hitung `absentCount = Math.max(0, totalActiveEmployees - presentCount)`.


* **Perubahan UI (Halaman Monitoring Absensi HRD):**
* Render 4 *Summary Cards* sejajar di atas barisan filter tanggal:


1. **Total Karyawan Aktif** (Netral/Biru)
2. **Sudah Absen Hari Ini** (Hijau)
3. **Belum Absen** (Abu-abu/Kuning)
4. **Terlambat** (Merah)


* Tambahkan filter *dropdown* **Status** (`Semua`, `Tepat Waktu`, `Terlambat`, `Belum Absen`) di barisan filter.





---

#### C. Fitur Export CSV pada Halaman Monitoring HRD

Memungkinkan HRD mengunduh laporan absensi sesuai filter aktif.

* **Implementasi Frontend/Gateway:**
* Tambahkan tombol **Export CSV** di sebelah tombol `Reset filter` pada halaman `Monitoring absensi`.


* Saat diklik, ambil seluruh data yang cocok dengan filter aktif (`fromDate`, `toDate`, `searchName`, `status`).


* Format menjadi *string* CSV dengan *header*: `NIK,Nama Karyawan,Tanggal,Jam (WIB),Status,Keterlambatan (Menit),Catatan`.


* Tambahkan UTF-8 BOM (`\uFEFF`) di awal *file* agar langsung terbaca rapi saat dibuka di Microsoft Excel, lalu unduh dengan nama `rekap-absensi-wfh-YYYY-MM-DD.csv`.



---

#### D. Docker Compose Terpadu & Dokumentasi Arsitektur (`README.md`)

Memastikan *reviewer* dapat menjalankan seluruh *stack* hanya dengan satu perintah.

* **Penyesuaian Konfigurasi Jaringan:**
* Ubah konfigurasi *host* TCP di `api-gateway`, `employee-service`, dan `attendance-service` agar membaca dari *environment variable* (`EMPLOYEE_SERVICE_HOST`, `ATTENDANCE_SERVICE_HOST`) dengan *fallback* ke `127.0.0.1` saat dijalankan secara lokal.


* **Struktur `docker-compose.yml`:**
* `mysql`: Menyediakan *init script* (`init.sql`) untuk membuat 2 skema/database terpisah (`wfh_employee_db` dan `wfh_attendance_db`) beserta *healthcheck*.


* `employee-service`: Menjalankan migrasi/sinkronisasi skema dan *seeder* otomatis untuk akun *dummy* (`admin@company.test` & `budi@company.test`).


* `attendance-service`: Menjalankan migrasi/sinkronisasi skema dan *seeder* awal `attendance_settings`.
* `api-gateway`: *Mount volume* khusus untuk direktori penyimpanan foto bukti absen agar file tidak hilang saat *container restart*.


* `frontend`: Build aplikasi React (Vite) dan sajikan melalui Nginx atau Vite Preview di port `:5173`.




* **Kelengkapan `README.md`:**
* Diagram alur komunikasi (React -> API Gateway HTTP :3000 -> TCP :3001 & :3002 -> MySQL).


* Daftar *Engineering Highlights* (Isolasi database tanpa FK lintas domain, pencegahan *N+1 query*, validasi *magic bytes*, serta *authenticated Blob image streaming*).
* Instruksi menjalankan (`docker compose up --build`) dan tabel kredensial *login* untuk *testing*.



---

### 3. Urutan Eksekusi yang Disarankan (Checklist)

1. **Backend (`libs/common` & `attendance-service`):** Tambah tabel `attendance_settings`, kolom `status` & `late_minutes`, lalu buat *handler* RPC untuk pengaturan, evaluasi keterlambatan, dan statistik harian.
2. **Backend (`api-gateway`):** Ekspos *endpoint* `/api/attendances/settings` dan `/api/attendances/summary`.
3. **Frontend (React):** Buat tab **Pengaturan absensi**, tambahkan **Summary Cards** + tombol **Export CSV** di halaman Monitoring, dan perbarui tampilan *badge* status keterlambatan.


4. **DevOps & Docs:** Uji seluruh *stack* di dalam `docker-compose.yml` dan finalisasi `README.md`.