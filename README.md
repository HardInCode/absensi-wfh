# Aplikasi Absensi WFH & Monitoring Karyawan

Aplikasi berbasis web untuk pencatatan absensi Work From Home (WFH) karyawan disertai bukti foto dan pemantauan data master karyawan serta absensi oleh Admin HRD.

---

## 🛠️ Tech Stack

- **Backend**: TypeScript, NestJS 10, TypeORM, MySQL 8
  - Keamanan & Validasi: Helmet, CORS, `@nestjs/jwt`, Passport JWT, bcrypt, class-validator, class-transformer
  - Dokumentasi API: Swagger (`@nestjs/swagger`)
  - Zona Waktu: `Asia/Jakarta` (WIB)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, React Router v6, Axios
- **Database & Container**: MySQL 8 via Docker Compose
- **Runtime Lokal**: Backend & Frontend dijalankan langsung via `npm`

---

## 📂 Struktur Repositori

```text
absensi-wfh/
├── docker-compose.yml          # Konfigurasi container database MySQL 8
├── README.md                   # Dokumentasi teknis & panduan instalasi
├── .env.example                # Panduan variabel lingkungan root
├── .gitignore
├── backend/                    # Layanan API (NestJS + TypeORM + MySQL 8)
│   ├── uploads/                # Direktori penyimpanan bukti foto WFH
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── .env.example
│   └── src/
└── frontend/                   # Web Client (React + Vite + Tailwind CSS)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
```

---

## 👥 Akun Demo & Role

Sesuai spesifikasi, dua role pengguna yang didukung:
1. **ADMIN_HRD**:
   - Email: `admin@company.test`
   - Password: `Admin123!`
   - Hak Akses: Mengelola data karyawan (CRUD), melihat riwayat absensi seluruh karyawan (read-only), serta melihat foto bukti absensi.
2. **EMPLOYEE**:
   - Email: `budi@company.test`
   - Password: `Karyawan123!`
   - Hak Akses: Melakukan check-in absensi dengan upload foto & catatan (1x per hari), melihat riwayat absensi miliknya sendiri.

---

## 🚀 Panduan Menjalankan Lokal

### 1. Prasyarat
- Docker & Docker Compose
- Node.js (v18 atau v20 disarankan) & npm

### 2. Menjalankan Database MySQL
Jalankan service database MySQL melalui Docker Compose di root direktori:
```bash
docker compose up -d
```

### 3. Menjalankan Backend
```bash
cd backend
npm install
npm run start:dev
```
- API Base URL: `http://localhost:3000/api`
- Swagger API Docs: `http://localhost:3000/api/docs`

### 4. Menjalankan Frontend
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173`

