export function PageSpinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 rounded-full border-2 border-line border-t-accent motion-safe:animate-spin"
      />
      {label}
    </div>
  );
}

