import axios from 'axios';

export function getStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export function getErrorMessage(
  err: unknown,
  fallback = 'Terjadi kesalahan. Silakan coba lagi.',
): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === 'ECONNABORTED'
        ? 'Permintaan terlalu lama. Periksa koneksi lalu coba lagi.'
        : 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.';
    }
    const { status, data } = err.response;
    if (status === 413) return 'Ukuran foto melebihi batas 3 MB.';

    const message = (data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(message) && message.length > 0) return message.join(', ');
    if (typeof message === 'string' && message) return message;

    if (status === 403) return 'Kamu tidak memiliki akses untuk tindakan ini.';
    if (status >= 500) return 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
  }
  return fallback;
}

