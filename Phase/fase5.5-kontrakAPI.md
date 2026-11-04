# Kontrak API Fase 5.5 (Settings, Summary, Filter Status, Export CSV)

Base URL: `/api` | Autentikasi: `Bearer <jwt_token>`
Format Error: `{"statusCode": number, "message": string | string[], "error": string}`
- Validasi DTO (400): `message` berupa array string constraint class-validator.
- Bisnis (400/409/403): `message` string (aturan hari kerja, jam mulai, catatan telat, absen ganda).

### 1. GET /api/attendances/settings
- **Role**: `EMPLOYEE`, `ADMIN_HRD`
- **Response 200**: `{"earliestCheckIn": "00:00", "defaultCutoffTime": "08:00", "toleranceMinutes": 15, "requireNoteWhenLate": false, "workingDays": [0,1,2,3,4,5,6]}`

### 2. PATCH /api/attendances/settings
- **Role**: `ADMIN_HRD`
- **Body** (parsial): `{"earliestCheckIn"?: "06:00", "defaultCutoffTime"?: "08:00", "toleranceMinutes"?: 15, "requireNoteWhenLate"?: true, "workingDays"?: [1,2,3,4,5]}`
- **Response 200**: Objek settings identik dengan `GET /settings`

### 3. GET /api/attendances/summary
- **Role**: `ADMIN_HRD`
- **Query**: `date?: string` (format `YYYY-MM-DD`, opsional, default: hari ini WIB)
- **Response 200**:
  `{"date": "2026-11-04", "totalEmployees": 10, "presentCount": 8, "onTimeCount": 7, "lateCount": 1, "absentCount": 2, "absentEmployees": [{"id": "uuid", "nik": "2000000001", "fullName": "Budi Santoso"}]}`
  *(Catatan: `totalEmployees` hanya menghitung karyawan aktif ber-role `EMPLOYEE`)*

### 4. GET /api/attendances/export
- **Role**: `ADMIN_HRD`
- **Query**: `dateFrom?` / `date_from`, `dateTo?` / `date_to` (`YYYY-MM-DD`), `search?` / `employee_name`, `employeeId?` (`UUID`), `status?: "ON_TIME" | "LATE"`
- **Response 200**: Stream CSV (`text/csv; charset=utf-8` dengan BOM UTF-8 `\uFEFF`)
- **Headers**: `Content-Disposition: attachment; filename="rekap-absensi-wfh-YYYY-MM-DD.csv"`, `X-Export-Truncated: "true" | "false"`
- **Cara Unduh Frontend**: Axios dengan `responseType: 'blob'`, parse nama file dari `headers['content-disposition']`, dan tampilkan badge peringatan terpotong jika `headers['x-export-truncated'] === 'true'`.

### 5. GET /api/attendances (Daftar Absensi HRD - Diubah)
- **Role**: `ADMIN_HRD`
- **Query**: `page?: number`, `limit?: number`, `dateFrom?` / `date_from`, `dateTo?` / `date_to`, `search?` / `employee_name`, `employeeId?`, `status?: "ON_TIME" | "LATE"`
- **Response 200**:
  `{"data": [{"id": "uuid", "employeeId": "uuid", "attendanceDate": "YYYY-MM-DD", "checkInAt": "ISO", "createdAt": "ISO", "photoUrl": "/api/attendances/:id/photo", "notes": "string|null", "status": "ON_TIME" | "LATE", "lateMinutes": 0, "employee": {"id": "uuid", "nik": "string", "fullName": "string"} | null}], "meta": {"total": 1, "page": 1, "limit": 10, "totalPages": 1}}`

### 6. Endpoint Absensi Karyawan yang Mendapat Field Baru
- **Endpoint**: `POST /api/attendances`, `GET /api/attendances/today`, `GET /api/attendances/mine` (alias `/me`)
- **Role**: `EMPLOYEE`
- **Field Baru pada Item**: `status: "ON_TIME" | "LATE"`, `lateMinutes: number` (0 jika tepat waktu, dihitung dari `defaultCutoffTime`).

