type SpinnerProps = {
  label: string;
};

export const Spinner = ({ label }: SpinnerProps) => (
  <div className="flex items-center justify-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--stroke)] border-t-[var(--primary-blue)]"
      aria-hidden="true"
    />
    {label}
  </div>
);
