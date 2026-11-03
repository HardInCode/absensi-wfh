# Fase 3 Versi Audit: Perbaikan Antislop (File & Kode)

Instruksi untuk AI agent: dokumen ini adalah lapisan perbaikan di atas frontend Fase 3 (`fase3-frontend-files.md`). Terapkan Fase 3 lebih dulu sampai selesai, lalu terapkan dokumen ini. Hasilnya sudah menggabungkan dua putaran audit menjadi keadaan akhir, jadi ikuti nilai di dokumen ini (bukan nilai lama di Fase 3, dan bukan nilai antara yang disebut di bagian alasan).

Cara menerapkan:
- **File ditulis ulang utuh:** `index.css`, `tailwind.config.ts`, `components/ui/button.tsx`.
- **File baru:** `components/Stamp.tsx` dan `DESIGN.md`.
- **File lain:** edit tertarget berpasangan "Cari" lalu "Ganti dengan". Teks "Cari" harus ada persis satu kali di file tersebut (sudah dicek terhadap kode Fase 3). Jika ada yang tidak ditemukan, berhenti dan laporkan file serta teksnya, jangan menebak.
- Semua path relatif terhadap `absensi-wfh/frontend/`.

Status: perubahan ini ditulis lewat membaca ulang kode, belum di-build dan belum diuji di browser (aturan R-35 antislop belum lulus). Setelah semua edit diterapkan, jalankan `npm run typecheck` dan `npm run build`, perbaiki error compile bila ada tanpa mengubah perilaku yang dijelaskan di sini, lalu uji manual dengan bagian "Cara mengetes".

---

## Keputusan desain & alasannya (penting dipahami sebelum mengimplementasikan)

Audit memakai kerangka antislop: HIGH = Hard Gate, MEDIUM = Purpose-Gate, LOW = Quality Lock. Dial desain: **ENERGY 1 / RHYTHM 2 / MOTION 1**, mode "Operate" (karyawan menyelesaikan satu tugas harian, HRD memindai tabel).

**Perubahan terpenting:**
- **Aksen berubah dari terrakota ke biru tinta `#1E4D8C`.** Alasan: kombinasi krem hangat + terrakota + serif editorial terlalu mirip tampilan Claude/Anthropic (temuan #9). Palet krem tetap. Hanya tiga nilai token yang berubah, karena semua warna sudah berupa token di `index.css`. Cara mengembalikan ke terrakota ada di `DESIGN.md`.
- **Token baru `accent-ink`** (`#17396B`) untuk teks kecil di atas latar `accent-soft` (badge, menu aktif, avatar inisial, stempel). Alasannya kontras: pada versi terrakota, `accent` di atas `accent-soft` hanya 4,52:1 (lolos tipis) untuk teks 12 px.
- **Logo kotak + ikon diganti wordmark teks "Absensi WFH".** Logo itu aset visual yang dibuat tanpa instruksi (R-23). Avatar inisial dipertahankan karena dihitung dari nama asli pengguna, bukan aset karangan.
- **Hierarki halaman absensi.** Jam tampil tanpa bingkai kartu, dan kartu "Absen hari ini" menjadi yang terbesar (empat kartu identik sebelumnya tidak punya titik fokus). Di HP urutannya: jam, absen, profil, riwayat.
- **Stempel dipakai ulang sebagai motif identitas** lewat komponen `Stamp`: label "Pratinjau" (waktu perangkat, di dropzone) dan "Tercatat" (waktu server, di absen yang sudah tersimpan).
- **Label dan header tabel memakai sentence case tanpa tracking lebar.** Huruf kapital berjarak lebar terlihat seperti templat dan lebih sulit dibaca dalam bahasa Indonesia.
- **Tanda pisah (`—` dan `·`) dibuang dari teks.** Data kosong memakai teks "Tanpa catatan"; teks meta dipisah dengan koma, titik, atau baris.
- **Semua kontrol interaktif punya kursor tangan dan state `active:`** (R-39).
- **Target sentuh 44 px** pada pointer kasar (HP), dan `overflow-x: clip` di `html` dan `body` agar tidak ada scroll horizontal.

**Kontras** (dihitung dengan skrip pada sesi audit, bukan hitungan tangan; belum diverifikasi ulang dengan alat browser):

| Pasangan | Rasio |
|---|---|
| putih di atas aksen biru | 8,42 |
| `accent-ink` `#17396B` di atas `accent-soft` | 9,54 |
| aksen biru di atas latar krem (non-teks) | 7,72 |
| teks sekunder di atas badge netral | 4,70 |
| hijau di atas hijau lembut | 5,01 |
| merah di atas merah lembut | 5,93 |
| batas input `edge` di atas putih | 3,47 |

**Sengaja tidak dikerjakan:**
- **Mode gelap (#13).** Brief menetapkan satu tema terang, dan kontras mode gelap belum bisa diuji. Token sudah berupa CSS variable sehingga bisa ditambahkan.
- **Animasi stempel jatuh dan kalender stempel di riwayat.** Keduanya menaikkan dial MOTION dari 1. Hanya dibuat jika pemilik proyek memintanya.
- **Ganti set ikon (#8) dan bento grid (#14).** Keduanya diminta eksplisit oleh brief; alasannya dicatat di `DESIGN.md`.

---

## Temuan audit dan statusnya

| # | Aturan | Temuan | Status |
|---|---|---|---|
| 1 | R-02 | `—` untuk data kosong di kolom Catatan monitoring | Diperbaiki: teks "Tanpa catatan" |
| 2 | R-39 | Kontrol tanpa cursor-pointer dan state `active:` | Diperbaiki |
| 3 | R-23 | Logo dan avatar dibuat tanpa instruksi | Logo diganti wordmark; avatar inisial dipertahankan |
| 4 | R-35 | Belum build dan klik-lewat | Terbuka: dikerjakan pemilik proyek |
| 5 | R-25 | Kontras teks aksen mepet | Diperbaiki: token `accent-ink` |
| 6 | R-06 | Label kapital bertracking lebar | Diperbaiki: sentence case |
| 7 | R-14 | Empat kartu seragam | Diperbaiki: jam tanpa kartu, kartu absen dominan |
| 8 | R-04 | Set ikon Lucide | Dicatat di DESIGN.md, tidak diubah |
| 9 | R-30 | Mirip tampilan Claude/Anthropic | Diperbaiki: aksen biru tinta |
| 10 | R-31 | DESIGN.md dan dial belum ada | Diperbaiki: DESIGN.md dibuat |
| 11 | R-20 | Motif identitas hanya muncul sekali | Diperbaiki: komponen `Stamp` |
| 12 | R-29 | Palet 3 warna inti + netral | Dicatat, dalam batas |
| 13 | R-21/R-34 | Tidak ada mode gelap | Ditunda |
| 14 | R-05 | Bento grid | Dicatat sebagai keputusan sengaja |
| 15 | ui-ux-pro-max | Target sentuh 32/40 px di HP | Diperbaiki: min-height 44 px pada pointer kasar |
| 16 | Hallmark Floor 4 | `overflow-x: clip` belum ada | Diperbaiki |
| 17 | Hallmark Floor 10 | Teks meta digabung titik tengah | Diperbaiki |

Tidak dijalankan pada audit: skill impeccable (butuh peluncur dan folder proyek), sloplint Hallmark, dan build.

---

## 1. File ditulis ulang utuh

### `absensi-wfh/frontend/src/index.css`
Perubahan dari Fase 3: tiga token aksen (biru tinta), token baru `--color-accent-ink`, aturan kursor, `overflow-x: clip`, dan target sentuh 44 px.
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
  Design token "Warm Editorial Workspace".
  Nilai berupa kanal RGB agar bisa dipakai dengan modifier opasitas Tailwind.
*/
@layer base {
  :root {
    --color-canvas: 247 245 240; /* #F7F5F0 latar */
    --color-card: 255 255 255; /* #FFFFFF kartu */
    --color-ink: 31 29 26; /* #1F1D1A teks */
    --color-muted: 107 102 94; /* #6B665E teks sekunder */
    --color-line: 228 223 213; /* #E4DFD5 garis dekoratif */
    --color-edge: 143 137 126; /* #8F897E batas kontrol input (kontras 3:1) */
    --color-accent: 30 77 140; /* #1E4D8C biru tinta */
    --color-accent-soft: 228 235 245; /* #E4EBF5 */
    --color-accent-ink: 23 57 107; /* #17396B teks aksen di atas latar lembut */
    --color-present: 47 111 94; /* #2F6F5E hijau sage */
    --color-present-soft: 227 239 234; /* #E3EFEA */
    --color-danger: 161 43 43; /* #A12B2B */
    --color-danger-soft: 248 228 225; /* #F8E4E1 */

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
  }

  html {
    color-scheme: light;
  }

  html,
  body {
    overflow-x: clip;
  }

  body {
    @apply bg-canvas font-sans text-ink antialiased;
  }

  button:not(:disabled),
  [role='button']:not([aria-disabled='true']),
  select:not(:disabled),
  label[for],
  summary {
    cursor: pointer;
  }

  @media (pointer: coarse) {
    button,
    [role='button'],
    select,
    input:not([type='checkbox']):not([type='file']) {
      min-height: 44px;
    }
    button {
      min-width: 44px;
    }
  }

  :focus-visible {
    outline: 2px solid rgb(var(--color-accent));
    outline-offset: 2px;
  }

  ::selection {
    background: rgb(var(--color-accent-soft));
    color: rgb(var(--color-ink));
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### `absensi-wfh/frontend/tailwind.config.ts`
Perubahan dari Fase 3: satu baris baru `accent-ink`.
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        edge: 'rgb(var(--color-edge) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        'accent-ink': 'rgb(var(--color-accent-ink) / <alpha-value>)',
        present: 'rgb(var(--color-present) / <alpha-value>)',
        'present-soft': 'rgb(var(--color-present-soft) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"DM Sans Variable"', '"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### `absensi-wfh/frontend/src/components/ui/button.tsx`
Perubahan dari Fase 3: state `active:` pada semua varian.
```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent/90 active:bg-accent/80',
        secondary: 'border border-edge bg-card text-ink hover:bg-canvas active:bg-line',
        ghost: 'text-muted hover:bg-line/60 hover:text-ink active:bg-line',
        danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
        'danger-ghost': 'text-danger hover:bg-danger-soft active:bg-danger/15',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-[13px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
```

---

## 2. File baru

### `absensi-wfh/frontend/src/components/Stamp.tsx`
```tsx
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  time: string;
  date: string;
  name?: string;
  className?: string;
}

/**
 * Stempel tinta: motif identitas aplikasi.
 * "Pratinjau" = hanya tampilan di perangkat. "Tercatat" = waktu resmi dari server.
 */
export function Stamp({ label, time, date, name, className }: Props) {
  return (
    <div
      className={cn(
        'inline-block -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent-ink',
        className,
      )}
    >
      <p className="text-xs font-semibold">{label}</p>
      <p className="font-display text-lg leading-tight tabular-nums">{time} WIB</p>
      <p className="text-xs tabular-nums">{date}</p>
      {name && <p className="truncate text-xs font-medium">{name}</p>}
    </div>
  );
}
```

### `absensi-wfh/frontend/DESIGN.md`
```md
# DESIGN.md: Absensi WFH

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1
Mode (impeccable): Operate. Karyawan menyelesaikan satu tugas harian, HRD memindai tabel.

## Alasan keputusan (satu baris per keputusan)

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
```

---

## 3. Edit tertarget

### `absensi-wfh/frontend/src/components/ui/badge.tsx`
Cari:
```
        accent: 'bg-accent-soft text-accent',
```
Ganti dengan:
```
        accent: 'bg-accent-soft text-accent-ink',
```

### `absensi-wfh/frontend/src/components/ui/dialog.tsx`
Cari:
```
        className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-ink"
```
Ganti dengan:
```
        className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-ink active:bg-line/60"
```

### `absensi-wfh/frontend/src/layouts/AppShell.tsx`
Edit 1, import. Cari:
```
import { CalendarCheck, ClipboardList, LogOut, Users } from 'lucide-react';
```
Ganti dengan:
```
import { ClipboardList, LogOut, Users } from 'lucide-react';
```

Edit 2, logo (ganti seluruh blok). Cari:
```
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-md bg-accent text-white">
                <CalendarCheck className="size-4" aria-hidden />
              </div>
              <span className="font-display text-lg leading-none">Absensi WFH</span>
            </div>
```
Ganti dengan:
```
            <span className="font-display text-xl leading-none">Absensi WFH</span>
```

Edit 3, menu aktif. Cari:
```
                          ? 'bg-accent-soft text-accent'
```
Ganti dengan:
```
                          ? 'bg-accent-soft text-accent-ink'
```

### `absensi-wfh/frontend/src/components/LiveClock.tsx`
Jam tampil tanpa bingkai kartu (hierarki halaman).

Edit 1. Cari (hapus baris ini seluruhnya):
```
import { Card } from '@/components/ui/card';
```
Ganti dengan: (kosong, baris dihapus)

Edit 2. Cari:
```
    <Card className={cn('flex flex-col justify-between p-6', className)}>
```
Ganti dengan:
```
    <div className={cn('flex flex-col justify-between py-2 lg:pr-8', className)}>
```

Edit 3. Cari:
```
    </Card>
```
Ganti dengan:
```
    </div>
```

### `absensi-wfh/frontend/src/components/PhotoDropzone.tsx`
Edit 1, import. Cari:
```
import { Button } from '@/components/ui/button';
```
Ganti dengan:
```
import { Stamp } from '@/components/Stamp';
import { Button } from '@/components/ui/button';
```

Edit 2, blok stempel. Cari:
```
          {/* Stempel pratinjau: waktu resmi tetap dari server */}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Pratinjau</p>
            <p className="font-display text-base leading-tight tabular-nums sm:text-lg">
              {formatDateShort(now)} · {formatTime(now)}
            </p>
            <p className="truncate text-xs font-medium">{stampName}</p>
          </div>
```
Ganti dengan:
```
          {/* Stempel pratinjau: waktu resmi tetap dari server */}
          <Stamp
            label="Pratinjau"
            time={formatTime(now)}
            date={formatDateShort(now)}
            name={stampName}
            className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
          />
```

Edit 3, teks bantuan. Cari:
```
JPG, PNG, atau WebP · maksimal 3 MB
```
Ganti dengan:
```
JPG, PNG, atau WebP, maksimal 3 MB
```

### `absensi-wfh/frontend/src/pages/LoginPage.tsx`
Edit 1, import (hapus `CalendarCheck`). Cari:
```
import {
  CalendarCheck,
  Camera,
```
Ganti dengan:
```
import {
  Camera,
```

Edit 2, logo panel desktop. Cari:
```
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-accent text-white">
            <CalendarCheck className="size-5" aria-hidden />
          </div>
          <span className="font-display text-xl">Absensi WFH</span>
        </div>
```
Ganti dengan:
```
        <span className="font-display text-2xl">Absensi WFH</span>
```

Edit 3, logo mobile. Cari:
```
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-9 place-items-center rounded-md bg-accent text-white">
              <CalendarCheck className="size-5" aria-hidden />
            </div>
            <span className="font-display text-xl">Absensi WFH</span>
          </div>
```
Ganti dengan:
```
          <span className="mb-8 block font-display text-2xl lg:hidden">Absensi WFH</span>
```

Edit 4, tombol mata password. Cari:
```
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
```
Ganti dengan:
```
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink active:bg-line/60"
```

Edit 5, label akun demo. Cari:
```
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
```
Ganti dengan:
```
            <p className="text-sm font-medium text-muted">
```

Edit 6, footer panel desktop. Cari:
```
Alat internal HRD · zona waktu WIB (Asia/Jakarta)
```
Ganti dengan:
```
Alat internal HRD. Zona waktu WIB (Asia/Jakarta).
```

### `absensi-wfh/frontend/src/pages/employee/AttendancePage.tsx`
Edit 1, import. Cari:
```
import { PhotoDropzone } from '@/components/PhotoDropzone';
```
Ganti dengan:
```
import { PhotoDropzone } from '@/components/PhotoDropzone';
import { Stamp } from '@/components/Stamp';
```

Edit 2, jam (urutan di HP). Cari:
```
        <LiveClock now={now} status={status} className="lg:col-span-7" />
```
Ganti dengan:
```
        <LiveClock now={now} status={status} className="order-1 lg:col-span-7" />
```

Edit 3, kartu profil. Cari:
```
        <Card className="p-6 lg:col-span-5">
```
Ganti dengan:
```
        <Card className="order-3 p-6 lg:order-2 lg:col-span-5">
```

Edit 4, avatar inisial. Cari:
```
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent"
```
Ganti dengan:
```
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-ink"
```

Edit 5, badge hadir. Cari:
```
                    <CheckCircle2 aria-hidden /> Hadir · {formatTimeShort(todayRecord.checkInAt)}
```
Ganti dengan:
```
                    <CheckCircle2 aria-hidden /> Hadir pukul {formatTimeShort(todayRecord.checkInAt)}
```

Edit 6, kartu absen (dominan). Cari:
```
        <Card className="p-6 lg:col-span-7">
```
Ganti dengan:
```
        <Card className="order-2 p-6 sm:p-8 lg:order-3 lg:col-span-7">
```

Edit 7, judul kartu absen. Cari:
```
          <CardTitle>Absen hari ini</CardTitle>
```
Ganti dengan:
```
          <CardTitle className="font-display text-2xl font-normal">Absen hari ini</CardTitle>
```

Edit 8, foto yang sudah tercatat diberi stempel "Tercatat". Cari:
```
              <AuthedImage
                attendanceId={todayRecord.id}
                alt="Foto bukti kerja hari ini"
                className="mt-4 aspect-[4/3] w-full rounded-lg border border-line"
              />
```
Ganti dengan:
```
              <div className="relative mt-4">
                <AuthedImage
                  attendanceId={todayRecord.id}
                  alt="Foto bukti kerja hari ini"
                  className="aspect-[4/3] w-full rounded-lg border border-line"
                />
                <Stamp
                  label="Tercatat"
                  time={formatTime(todayRecord.checkInAt)}
                  date={formatYmd(todayRecord.attendanceDate)}
                  name={user.fullName}
                  className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
                />
              </div>
```

Edit 9, kartu riwayat. Cari:
```
        <Card className="lg:col-span-5">
```
Ganti dengan:
```
        <Card className="order-4 lg:col-span-5">
```

### `absensi-wfh/frontend/src/pages/admin/EmployeesPage.tsx`
Cari:
```
const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
```
Ganti dengan:
```
const TH = 'px-4 py-2.5 text-left text-[13px] font-medium text-muted';
```

### `absensi-wfh/frontend/src/pages/admin/AttendanceMonitorPage.tsx`
Edit 1, header tabel. Cari:
```
const TH = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted';
```
Ganti dengan:
```
const TH = 'px-4 py-2.5 text-left text-[13px] font-medium text-muted';
```

Edit 2, data kosong kolom Catatan. Cari:
```
                            <span className="text-muted">—</span>
```
Ganti dengan:
```
                            <span className="text-muted">Tanpa catatan</span>
```

Edit 3, pemisah NIK dan jabatan. Cari:
```
                            <span className="tabular-nums">{row.employee.nik}</span> ·{' '}
```
Ganti dengan:
```
                            <span className="tabular-nums">{row.employee.nik}</span>,{' '}
```

---

## Daftar file

Ditulis ulang utuh (3): `src/index.css`, `tailwind.config.ts`, `src/components/ui/button.tsx`.

Baru (2): `src/components/Stamp.tsx`, `DESIGN.md`.

Diedit tertarget (9): `src/components/ui/badge.tsx`, `src/components/ui/dialog.tsx`, `src/layouts/AppShell.tsx`, `src/components/LiveClock.tsx`, `src/components/PhotoDropzone.tsx`, `src/pages/LoginPage.tsx`, `src/pages/employee/AttendancePage.tsx`, `src/pages/admin/EmployeesPage.tsx`, `src/pages/admin/AttendanceMonitorPage.tsx`.

---

## Cara mengetes

1. `cd frontend && npm run typecheck && npm run build` harus lolos tanpa error. Jika ada error, laporkan lengkap dengan nama file dan barisnya.
2. **Aksen biru:** tombol utama, menu aktif, badge aksen, dan stempel berwarna biru. Tidak boleh ada sisa warna terrakota di tampilan.
3. **Kursor dan state aktif:** arahkan kursor ke tombol, select, label checkbox, tombol mata password, dan tombol tutup dialog; kursor harus berubah jadi tangan. Tekan dan tahan tombol; warnanya harus bergeser.
4. **Logo:** hanya teks "Absensi WFH" di header dan di halaman login (desktop dan HP), tanpa kotak atau ikon.
5. **Halaman `/absensi`:** jam tampil tanpa kotak kartu, kartu "Absen hari ini" paling besar dengan judul serif. Di lebar HP urutannya jam, absen, profil, riwayat.
6. **Stempel:** pilih foto; stempel "Pratinjau" muncul. Setelah absen terkirim, stempel "Tercatat" dengan jam server muncul di foto.
7. **Badge status:** menampilkan "Hadir pukul HH:mm" (tanpa titik tengah).
8. **Tabel HRD:** header berhuruf biasa (bukan kapital). Di `/admin/absensi`, baris tanpa catatan menampilkan "Tanpa catatan", dan baris karyawan memakai koma antara NIK dan jabatan.
9. **HP (pointer kasar):** tombol dan input minimal setinggi 44 px, dan tidak ada scroll horizontal pada halaman.
10. **Kontras:** periksa dengan alat browser (mis. Lighthouse atau DevTools) pada badge, menu aktif, dan stempel untuk memastikan hasil hitungan skrip.
