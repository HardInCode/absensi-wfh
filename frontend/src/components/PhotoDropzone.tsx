import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Camera, ImagePlus, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/Stamp';
import { formatDateShort, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024;
/** Sisi terpanjang hasil jepretan; cukup tajam sebagai bukti, ukuran file tetap kecil. */
const MAX_SIDE = 1280;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

type CameraStatus = 'idle' | 'starting' | 'live';
type InputMode = 'camera' | 'upload';

interface CameraNotice {
  message: string;
  /** true = kamera tidak bisa dipakai, tampilkan unggah file sebagai gantinya. */
  fallback: boolean;
}

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  stampName: string;
  /** Waktu (sinkron server) untuk stempel pratinjau */
  now: Date;
  disabled?: boolean;
}

function describeCameraError(err: unknown): CameraNotice {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      fallback: true,
      message:
        'Izin kamera ditolak. Izinkan akses kamera lewat ikon gembok di address bar, lalu coba lagi. Atau unggah foto dari perangkat.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      fallback: true,
      message: 'Kamera tidak ditemukan di perangkat ini. Unggah foto dari perangkat sebagai gantinya.',
    };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return {
      fallback: true,
      message:
        'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi, atau unggah foto dari perangkat.',
    };
  }
  return {
    fallback: true,
    message: 'Kamera tidak dapat dibuka. Coba lagi, atau unggah foto dari perangkat.',
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export function PhotoDropzone({ file, onChange, stampName, now, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Penanda permintaan kamera terbaru; hasil permintaan lama dibuang. */
  const requestRef = useRef(0);

  const [mode, setMode] = useState<InputMode>('camera');
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [notice, setNotice] = useState<CameraNotice | null>(null);
  const [source, setSource] = useState<'camera' | 'upload'>('camera');
  const [capturing, setCapturing] = useState(false);

  // ---- Pratinjau file ----
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ---- Siklus hidup kamera ----
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cancelCamera = useCallback(() => {
    requestRef.current += 1;
    stopTracks();
    setStream(null);
    setStatus('idle');
  }, [stopTracks]);

  const startCamera = useCallback(async () => {
    setLocalError(null);

    if (!window.isSecureContext) {
      setNotice({
        fallback: true,
        message:
          'Kamera hanya bisa dipakai lewat HTTPS atau localhost. Unggah foto dari perangkat sebagai gantinya.',
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice({
        fallback: true,
        message: 'Browser ini tidak mendukung akses kamera. Unggah foto dari perangkat sebagai gantinya.',
      });
      return;
    }

    stopTracks();
    const id = ++requestRef.current;
    setNotice(null);
    setStatus('starting');

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (id !== requestRef.current) {
        // Dibatalkan atau komponen ditutup saat menunggu izin: langsung matikan.
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = media;
      setStream(media);
    } catch (err) {
      if (id !== requestRef.current) return;
      setStatus('idle');
      setNotice(describeCameraError(err));
    }
  }, [stopTracks]);

  // Sambungkan stream ke elemen <video> dan pantau kamera yang terputus.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => undefined);

    const track = stream.getVideoTracks()[0];
    const onEnded = () => {
      cancelCamera();
      setNotice({
        fallback: false,
        message: 'Kamera terputus. Buka kembali kamera untuk melanjutkan.',
      });
    };
    track?.addEventListener('ended', onEnded);
    return () => track?.removeEventListener('ended', onEnded);
  }, [stream, cancelCamera]);

  // Matikan kamera saat tab disembunyikan.
  useEffect(() => {
    if (status === 'idle') return;
    const onHide = () => {
      if (!document.hidden) return;
      cancelCamera();
      setNotice({
        fallback: false,
        message: 'Kamera dimatikan karena kamu berpindah tab. Buka kembali kamera untuk melanjutkan.',
      });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [status, cancelCamera]);

  // Matikan kamera saat komponen ditutup / pindah halaman.
  useEffect(() => {
    return () => {
      requestRef.current += 1;
      stopTracks();
    };
  }, [stopTracks]);

  // ---- Ambil foto ----
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) return;
    setCapturing(true);
    setLocalError(null);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      // Frame digambar apa adanya (tidak dicerminkan) agar hasilnya sesuai kenyataan.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let blob: Blob | null = null;
      for (const quality of JPEG_QUALITIES) {
        blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size <= MAX_BYTES) break;
      }
      if (!blob || blob.size > MAX_BYTES) {
        setLocalError('Foto gagal diproses. Coba ambil ulang.');
        return;
      }

      const captured = new File([blob], `absen-${Date.now()}.jpg`, { type: 'image/jpeg' });
      cancelCamera();
      setSource('camera');
      onChange(captured);
    } catch {
      setLocalError('Foto gagal diproses. Coba ambil ulang.');
    } finally {
      setCapturing(false);
    }
  }

  // ---- Unggah file ----
  function pick(list: FileList | null) {
    const candidate = list?.[0];
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setLocalError('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setLocalError('Ukuran foto maksimal 3 MB.');
      return;
    }
    setLocalError(null);
    setSource('upload');
    onChange(candidate);
  }

  function clear() {
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function retake() {
    if (source === 'camera') {
      clear();
      setMode('camera');
      void startCamera();
    } else {
      inputRef.current?.click();
    }
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) pick(e.dataTransfer.files);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  const showPreview = Boolean(file && previewUrl);
  const showCamera = !showPreview && status !== 'idle';
  const showFallback = !showPreview && !showCamera && mode === 'camera' && notice?.fallback === true;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => pick(e.target.files)}
      />

      {/* Pilihan Mode Tab (Kamera vs Unggah Berkas) - Tampil saat belum ada foto dan kamera tidak sedang aktif */}
      {!showPreview && !showCamera && (
        <div className="flex rounded-lg border border-line bg-card p-1 text-xs font-medium">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              cancelCamera();
              setMode('camera');
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition-all',
              mode === 'camera'
                ? 'bg-accent-soft font-semibold text-accent-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            <Camera className="size-4" />
            Ambil dari Kamera
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              cancelCamera();
              setMode('upload');
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition-all',
              mode === 'upload'
                ? 'bg-accent-soft font-semibold text-accent-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            <Upload className="size-4" />
            Unggah Berkas
          </button>
        </div>
      )}

      {/* 1. Hasil foto + stempel pratinjau */}
      {showPreview && previewUrl && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          <Stamp
            label="Pratinjau"
            time={formatTime(now)}
            date={formatDateShort(now)}
            name={stampName}
            className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
          />

          <div className="absolute right-3 top-3 flex gap-2">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={retake}>
              <RotateCcw /> Ulangi
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={clear}
              aria-label="Hapus foto"
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {/* 2. Kamera aktif */}
      {showCamera && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-ink">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Pratinjau kamera depan"
            onPlaying={() => setStatus((s) => (s === 'starting' ? 'live' : s))}
            className="h-full w-full -scale-x-100 object-cover"
          />

          {status === 'starting' && (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink text-center text-white"
            >
              <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
              <p className="text-sm font-medium">Menyalakan kamera…</p>
              <p className="px-6 text-xs text-white/70">
                Jika browser meminta izin, pilih &ldquo;Izinkan&rdquo;.
              </p>
            </div>
          )}

          <div className="absolute right-3 top-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelCamera}
              disabled={capturing}
              aria-label="Tutup kamera"
            >
              <X />
            </Button>
          </div>

          {status === 'live' && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <Button onClick={capture} disabled={capturing || disabled}>
                {capturing ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Camera />
                )}
                {capturing ? 'Memproses…' : 'Ambil foto'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Kamera tidak bisa dipakai: pesan peringatan + fallback unggah file */}
      {showFallback && (
        <div className="space-y-3">
          <div
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {notice?.message}
          </div>

          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label="Pilih foto bukti kerja"
            onClick={() => !disabled && inputRef.current?.click()}
            onKeyDown={onKeyDown}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent active:bg-accent-soft/40',
              dragging && 'border-accent bg-accent-soft',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <ImagePlus className="size-7 text-accent" aria-hidden />
            <p className="text-sm font-medium text-ink">
              Tarik foto ke sini atau pilih dari perangkat
            </p>
            <p className="text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB</p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => void startCamera()} disabled={disabled}>
            <Camera /> Coba kamera lagi
          </Button>
        </div>
      )}

      {/* 4A. Mode Kamera: Kamera belum dibuka (kondisi normal tanpa error) */}
      {!showPreview && !showCamera && !showFallback && mode === 'camera' && (
        <div className="space-y-3">
          {notice && (
            <div
              role="status"
              className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-ink"
            >
              {notice.message}
            </div>
          )}
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center">
            <Camera className="size-7 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink">Ambil foto bukti kerja dari kamera</p>
              <p className="mt-1 text-xs text-muted">
                Kamera depan akan dipakai. Pastikan wajah dan ruang kerjamu terlihat jelas.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => void startCamera()} disabled={disabled}>
                <Camera /> Buka kamera
              </Button>
              <button
                type="button"
                onClick={() => setMode('upload')}
                disabled={disabled}
                className="text-xs text-accent underline-offset-4 hover:underline"
              >
                Atau pilih file dari perangkat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4B. Mode Unggah Berkas: Drag and drop atau klik untuk memilih file */}
      {!showPreview && !showCamera && mode === 'upload' && (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label="Pilih foto bukti kerja dari perangkat"
            onClick={() => !disabled && inputRef.current?.click()}
            onKeyDown={onKeyDown}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent active:bg-accent-soft/40',
              dragging && 'border-accent bg-accent-soft',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <ImagePlus className="size-7 text-accent" aria-hidden />
            <p className="text-sm font-medium text-ink">
              Tarik foto ke sini atau pilih dari perangkat
            </p>
            <p className="text-xs text-muted">JPG, PNG, atau WebP, maksimal 3 MB</p>
          </div>
        </div>
      )}

      {showPreview && (
        <p className="mt-2 text-xs text-muted">
          Stempel di atas hanya pratinjau. Waktu absen resmi dicatat server saat kamu menekan kirim.
        </p>
      )}
      {localError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {localError}
        </p>
      )}
    </div>
  );
}
