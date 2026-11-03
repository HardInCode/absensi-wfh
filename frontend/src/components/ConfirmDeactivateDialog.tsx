import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deactivateEmployee, getErrorMessage, type Employee } from "@/lib/hrdApi";

interface ConfirmDeactivateDialogProps {
  /** null = dialog tertutup. */
  employee: Employee | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ConfirmDeactivateDialog({ employee, onClose, onDone }: ConfirmDeactivateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSubmitting(false);
  }, [employee]);

  async function handleConfirm() {
    if (!employee || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deactivateEmployee(employee.id);
      onDone(`${employee.fullName} dinonaktifkan. Akun ini tidak dapat login lagi.`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menonaktifkan karyawan."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => (!open && !submitting ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogTitle>Nonaktifkan karyawan?</DialogTitle>
        <DialogDescription>
          {employee?.fullName} tidak akan bisa login. Riwayat absensinya tetap tersimpan, dan akun bisa diaktifkan
          kembali lewat menu ubah.
        </DialogDescription>

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="min-h-11 sm:min-h-0">
            Batal
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={submitting} className="min-h-11 sm:min-h-0">
            {submitting ? "Memproses..." : "Nonaktifkan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

