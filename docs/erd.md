# ERD Absensi WFH

Dokumen ini disusun dari entity TypeORM yang ada:

- `employees` dari `apps/employee-service/src/employees/entities/employee.entity.ts`
- `attendances` dari `apps/attendance-service/src/attendances/entities/attendance.entity.ts`
- `attendance_settings` dari `apps/attendance-service/src/attendances/entities/attendance-settings.entity.ts`

Ketiga tabel berada di satu instance MySQL dan satu skema (`absensi_wfh`), tetapi dimiliki dua service berbeda.

> **Catatan penting: tidak ada foreign key lintas service.**
> Kolom `attendances.employee_id` berisi UUID dari `employees.id`, tetapi **tidak ada FK fisik** di database dan **tidak ada relasi TypeORM** (`@ManyToOne`/`@OneToMany`) antar entity. Hubungan ini hanya referensi lunak di level aplikasi. Penggabungan data (nama dan NIK karyawan pada daftar absensi, filter nama, ringkasan harian) dilakukan oleh `api-gateway` lewat RPC ke kedua service. Garis putus-putus pada diagram di bawah menandai referensi lunak ini.

## Diagram relasi entity

```mermaid
erDiagram
    employees ||..o{ attendances : "referensi lunak via employee_id (tanpa FK)"

    employees {
        varchar id PK "UUID"
        varchar nik UK
        varchar full_name
        varchar email UK
        varchar password_hash "bcrypt, select:false"
        varchar position
        enum role "EMPLOYEE | ADMIN_HRD"
        boolean is_active "default true"
        datetime created_at
        datetime updated_at
    }

    attendances {
        varchar id PK "UUID"
        varchar employee_id "UK1, referensi lunak ke employees.id"
        datetime check_in_at "dibuat server"
        date attendance_date "UK2, tanggal WIB"
        varchar photo_path "internal, tidak dikirim ke klien"
        varchar photo_hash "SHA-256, nullable, diindeks"
        varchar notes "nullable"
        enum status "ON_TIME | LATE, default ON_TIME"
        int late_minutes "default 0"
        datetime created_at
    }

    attendance_settings {
        int id PK "selalu 1 (satu baris)"
        varchar earliest_check_in "HH:mm"
        varchar default_cutoff_time "HH:mm"
        int tolerance_minutes
        boolean require_note_when_late
        json working_days "0=Minggu ... 6=Sabtu"
        datetime updated_at
    }
```

`attendance_settings` sengaja tidak punya relasi ke tabel mana pun: ia konfigurasi global (satu baris, `id = 1`), dibaca saat absen dibuat.

## Batas kepemilikan antar service

```mermaid
flowchart LR
    subgraph ES["employee-service"]
        T1[("employees")]
    end
    subgraph AS["attendance-service"]
        T2[("attendances")]
        T3[("attendance_settings")]
    end
    GW["api-gateway<br/>(tidak punya tabel)"]

    GW -->|"RPC employees.*, auth.*"| ES
    GW -->|"RPC attendances.*"| AS
    T2 -. "employee_id: referensi lunak, bukan FK" .-> T1
```

Aturan yang berlaku:

- Hanya `employee-service` yang membaca dan menulis `employees`; hanya `attendance-service` yang membaca dan menulis `attendances` dan `attendance_settings`.
- `attendance-service` tidak pernah melakukan `JOIN` ke `employees`. Jika membutuhkan data karyawan, gateway yang mengambilnya dari `employee-service`.
- Konsekuensi: database tidak mencegah `employee_id` yang tidak ada di `employees`. Integritas dijaga di level aplikasi (hanya karyawan yang lolos autentikasi yang bisa membuat absen) dan lewat soft delete (`is_active = false`), sehingga baris karyawan tidak pernah benar-benar hilang dan riwayat absensi tidak menjadi yatim.

## Kamus data

### `employees` (milik employee-service)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | varchar(36) | PK | UUID, dibangkitkan otomatis |
| `nik` | varchar(30) | UNIQUE | |
| `full_name` | varchar(150) | | |
| `email` | varchar(150) | UNIQUE | |
| `password_hash` | varchar(100) | | Hash bcrypt; `select: false` sehingga tidak ikut terambil kecuali diminta eksplisit (saat login) |
| `position` | varchar(100) | | Jabatan |
| `role` | enum(`ADMIN_HRD`,`EMPLOYEE`) | default `EMPLOYEE` | |
| `is_active` | tinyint(1) | default 1 | `false` = soft delete, tidak bisa login |
| `created_at` | datetime(6) | default CURRENT_TIMESTAMP(6) | |
| `updated_at` | datetime(6) | default CURRENT_TIMESTAMP(6) on update CURRENT_TIMESTAMP(6) | |

### `attendances` (milik attendance-service)

| Kolom | Tipe | Constraint | Keterangan |
|---|---|---|---|
| `id` | varchar(36) | PK | UUID |
| `employee_id` | varchar(36) | bagian dari `UQ_attendance_employee_date` | Referensi lunak ke `employees.id`, **tanpa FK** |
| `check_in_at` | datetime | | Waktu absen, dibuat server |
| `attendance_date` | date | bagian dari `UQ_attendance_employee_date`; indeks `IDX_attendance_date` | Tanggal kalender WIB, diturunkan dari `check_in_at` di server |
| `photo_path` | varchar(255) | | Nama berkas di folder `uploads/`; internal |
| `photo_hash` | varchar(64) | NULL; indeks `IDX_attendance_photo_hash` (tidak unik) | SHA-256 isi foto (heksadesimal); `NULL` untuk data sebelum fitur deteksi duplikat |
| `notes` | varchar(500) | NULL | Catatan karyawan |
| `status` | enum(`ON_TIME`,`LATE`) | default `ON_TIME` | Dihitung dan disimpan saat absen, tidak dihitung ulang saat pengaturan berubah |
| `late_minutes` | int | default 0 | Menit keterlambatan dari batas jam masuk dasar |
| `created_at` | datetime(6) | default CURRENT_TIMESTAMP(6) | |

Constraint dan indeks:

- `UQ_attendance_employee_date` = `UNIQUE (employee_id, attendance_date)`: satu absen per karyawan per hari.
- `IDX_attendance_date` pada `attendance_date`.
- `IDX_attendance_photo_hash` pada `photo_hash`.

### `attendance_settings` (milik attendance-service)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | int, PK | Selalu `1` (konfigurasi satu baris; konstanta `ATTENDANCE_SETTINGS_ID`) |
| `earliest_check_in` | varchar(5) | Jam paling awal absen diperbolehkan, format `HH:mm` (WIB), default `'00:00'` |
| `default_cutoff_time` | varchar(5) | Batas jam masuk, format `HH:mm` (WIB), default `'08:00'` |
| `tolerance_minutes` | int | Toleransi keterlambatan (menit), default `15` |
| `require_note_when_late` | boolean | Catatan wajib jika terlambat, default `false` (`0`) |
| `working_days` | json | Array angka hari kerja, 0 = Minggu sampai 6 = Sabtu, default `[0, 1, 2, 3, 4, 5, 6]` |
| `updated_at` | datetime | Waktu pembaruan terakhir |

## Hal yang telah diverifikasi

1. **Tipe `datetime` sebenarnya di MySQL:**
   - Hasil eksekusi `SHOW CREATE TABLE employees` menunjukkan kolom audit menggunakan `datetime(6)` dengan presisi mikrodetik:
     ```sql
     `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
     `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
     ```
   - Hasil eksekusi `SHOW CREATE TABLE attendances` menunjukkan `check_in_at` menggunakan `datetime` standar (presisi detik), sedangkan `created_at` menggunakan `datetime(6)`:
     ```sql
     `check_in_at` datetime NOT NULL,
     `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
     ```

2. **Ketiadaan FOREIGN KEY fisik antar-tabel:**
   - Hasil `SHOW CREATE TABLE attendances` membuktikan tidak ada satupun klausul `CONSTRAINT ... FOREIGN KEY` fisik di level database MySQL. Hubungan ke `employees.id` murni referensi lunak `employee_id` di level aplikasi:
     ```sql
     PRIMARY KEY (`id`),
     UNIQUE KEY `UQ_attendance_employee_date` (`employee_id`,`attendance_date`),
     KEY `IDX_attendance_date` (`attendance_date`),
     KEY `IDX_attendance_photo_hash` (`photo_hash`)
     ```

3. **Konfigurasi Timezone di `typeorm.config.ts`:**
   - Pada `backend/libs/common/src/database/typeorm.config.ts` baris 17, timezone diatur secara eksplisit ke `+07:00`:
     ```ts
     export function buildTypeOrmOptions(...): TypeOrmModuleOptions {
       return {
         ...
         timezone: '+07:00',
         charset: 'utf8mb4',
       };
     }
     ```
   - Pengaturan ini selaras dengan konfigurasi MySQL container di `docker-compose.yml` (`command: ['mysqld', '--default-time-zone=+07:00']`).

4. **Nilai Awal `DEFAULT_ATTENDANCE_SETTINGS` & Data Nyata di Database:**
   - Didefinisikan di `backend/libs/common/src/utils/attendance-settings.util.ts`:
     ```ts
     export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsRecord = {
       earliestCheckIn: '00:00',
       defaultCutoffTime: '08:00',
       toleranceMinutes: 15,
       requireNoteWhenLate: false,
       workingDays: [0, 1, 2, 3, 4, 5, 6],
     };
     ```
   - Hasil query `SELECT * FROM attendance_settings WHERE id = 1\G` di MySQL container `absensi-mysql`:
     ```text
     *************************** 1. row ***************************
                         id: 1
          earliest_check_in: 00:00
        default_cutoff_time: 08:00
          tolerance_minutes: 15
     require_note_when_late: 0
               working_days: [0, 1, 2, 3, 4, 5, 6]
     ```
   - Dibuat otomatis saat inisialisasi `attendance-service` (`onModuleInit`) secara idempoten jika baris `id = 1` belum ada.

5. **Deteksi Duplikat Foto (SHA-256) & Rollback:**
   - Gateway menghitung SHA-256 buffer foto pada upload; `attendance-service` menolak duplikat lintas karyawan dengan HTTP 400 (`BadRequestException`) dan pesan `"Foto ini sudah pernah digunakan. Ambil foto baru."`. Gateway secara otomatis menghapus berkas foto fisik (rollback) bila terjadi kegagalan.

