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

