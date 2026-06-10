type PageStateProps = {
  eyebrow?: string;
  title: string;
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function PageState({
  eyebrow,
  title,
  message,
  loading = false,
  actionLabel,
  onAction
}: PageStateProps) {
  return (
    <main className="shell page-state-shell" aria-busy={loading}>
      <section className="card page-state-card" role={loading ? "status" : "alert"}>
        {loading && (
          <div className="page-state-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{message}</p>
        {actionLabel && onAction && (
          <button className="btn-primary" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  );
}
