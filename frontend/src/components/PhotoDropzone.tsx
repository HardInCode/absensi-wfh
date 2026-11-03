import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateShort, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 3 * 1024 * 1024;

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  stampName: string;
  /** Waktu (sinkron server) untuk stempel pratinjau */
  now: Date;
  disabled?: boolean;
}

export function PhotoDropzone({ file, onChange, stampName, now, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
    onChange(candidate);
  }

  function clear() {
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
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

  return (
    <div>
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

      {!file || !previewUrl ? (
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
            'flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-edge bg-canvas px-6 text-center transition-colors hover:border-accent',
            dragging && 'border-accent bg-accent-soft',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <ImagePlus className="size-7 text-accent" aria-hidden />
          <p className="text-sm font-medium text-ink">
            Tarik foto ke sini atau pilih dari perangkat
          </p>
          <p className="text-xs text-muted">JPG, PNG, atau WebP · maksimal 3 MB</p>
        </div>
      ) : (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={previewUrl}
            alt="Pratinjau foto bukti kerja"
            className="h-full w-full object-cover"
          />

          {/* Stempel pratinjau: waktu resmi tetap dari server */}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] -rotate-2 rounded-md border-2 border-accent bg-card px-3 py-2 text-accent">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Pratinjau</p>
            <p className="font-display text-base leading-tight tabular-nums sm:text-lg">
              {formatDateShort(now)} · {formatTime(now)}
            </p>
            <p className="truncate text-xs font-medium">{stampName}</p>
          </div>

          <div className="absolute right-3 top-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw /> Ganti
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

      {file && (
        <p className="mt-2 text-xs text-muted">
          Stempel di atas hanya pratinjau. Waktu absen resmi dicatat server saat kamu menekan
          kirim.
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

