import { APP_TIMEZONE } from '../../common/constants/app.constants';

const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Mengembalikan tanggal (YYYY-MM-DD) menurut zona waktu Asia/Jakarta.
 * Locale en-CA menghasilkan format ISO YYYY-MM-DD.
 */
export function toJakartaDateString(date: Date): string {
  return jakartaDateFormatter.format(date);
}

