import { useEffect, useState } from 'react';
import axios from 'axios';
import { ImageOff } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  attendanceId: string;
  alt: string;
  className?: string;
}

/**
 * Foto absensi butuh header Authorization, jadi diambil sebagai blob lalu
 * ditampilkan lewat object URL (dibebaskan saat unmount).
 */
export function AuthedImage({ attendanceId, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setState('loading');
    setSrc(null);

    api
      .get<Blob>(`/attendances/${attendanceId}/photo`, {
        responseType: 'blob',
        signal: controller.signal,
      })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
        setState('ready');
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setState('error');
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attendanceId]);

  return (
    <div className={cn('relative overflow-hidden bg-line/50', className)}>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      {state === 'error' && (
        <div
          role="img"
          aria-label="Foto tidak dapat dimuat"
          className="grid h-full w-full place-items-center text-muted"
        >
          <ImageOff className="size-4" aria-hidden />
        </div>
      )}
      {state === 'ready' && src && (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

