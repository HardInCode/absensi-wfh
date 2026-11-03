import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Camera,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, getStatus } from '@/lib/errors';
import { homeFor } from '@/lib/routes';

const HIGHLIGHTS = [
  { icon: Camera, text: 'Unggah satu foto sebagai bukti kamu bekerja dari rumah.' },
  { icon: Clock, text: 'Tanggal dan jam dicatat server, bukan perangkatmu.' },
  { icon: ShieldCheck, text: 'Foto hanya bisa dilihat oleh kamu dan tim HRD.' },
];

const DEMO_ACCOUNTS = [
  { label: 'Admin HRD', email: 'admin@company.test', password: 'Admin123!' },
  { label: 'Karyawan', email: 'budi@company.test', password: 'Karyawan123!' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const status = getStatus(err);
      if (status === 401) setError('Email atau kata sandi salah.');
      else if (status === 403) setError('Akun kamu nonaktif. Hubungi tim HRD.');
      else setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line bg-card p-12 lg:flex">
        <div>
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            Absensi WFH
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-5xl leading-[1.1] text-ink">
            Kerja dari rumah, kehadiran tetap tercatat rapi.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted">
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted">Alat internal HRD (zona waktu WIB Asia/Jakarta)</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-semibold tracking-tight text-ink">
              Absensi WFH
            </span>
          </div>

          <h1 className="font-display text-4xl text-ink">Masuk</h1>
          <p className="mt-1 text-sm text-muted">Gunakan akun yang diberikan oleh HRD.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink cursor-pointer active:scale-95"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              {submitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-xs font-medium text-muted">
              Akun demo (khusus pengembangan)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.email}
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError(null);
                  }}
                >
                  Isi sebagai {acc.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
