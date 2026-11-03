import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center text-ink">
      <p className="font-display text-5xl font-semibold">404</p>
      <p className="text-muted">Halaman yang Anda cari tidak ditemukan.</p>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}

