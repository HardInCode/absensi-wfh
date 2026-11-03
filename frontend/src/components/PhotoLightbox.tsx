import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertIcon } from "@/components/icons";
import { useProtectedImage } from "@/hooks/useProtectedImage";

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendanceId: string | null;
  title: string;
  subtitle?: string;
}

export function PhotoLightbox({ open, onOpenChange, attendanceId, title, subtitle }: PhotoLightboxProps) {
  const { src, status } = useProtectedImage(open ? attendanceId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{subtitle ?? "Foto bukti absensi"}</DialogDescription>

        <div className="mt-4 overflow-hidden rounded-md bg-canvas">
          {status === "loading" && <Skeleton className="h-72 w-full" />}
          {status === "error" && (
            <div role="alert" className="flex h-72 flex-col items-center justify-center gap-2 text-center">
              <AlertIcon className="h-7 w-7 text-danger" />
              <p className="text-sm text-muted">Foto tidak dapat dimuat. Tutup dan coba lagi.</p>
            </div>
          )}
          {status === "ready" && src && (
            <img src={src} alt={`Foto bukti absensi ${title}`} className="max-h-[70vh] w-full object-contain" />
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="min-h-11 sm:min-h-0">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

