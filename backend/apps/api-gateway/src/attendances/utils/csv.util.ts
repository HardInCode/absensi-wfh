/** Sel teks yang diawali karakter ini dibaca Excel/Sheets sebagai rumus (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Netralkan rumus dengan awalan apostrof. Hanya untuk sel teks, bukan angka. */
export function sanitizeCsvText(value: string | null | undefined): string {
  const s = value ?? '';
  return FORMULA_START.test(s) ? `'${s}` : s;
}

type CsvValue = string | number | null | undefined;

/** Sanitasi (teks saja), lalu bungkus tanda kutip jika ada koma, kutip, atau baris baru; " digandakan. */
export function csvCell(value: CsvValue): string {
  const s = typeof value === 'number' ? String(value) : sanitizeCsvText(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baris dipisah CRLF (RFC 4180), diakhiri CRLF. BOM ditambahkan oleh pemanggil. */
export function buildCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

