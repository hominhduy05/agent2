// Re-export AppShell from its own file
export { AppShell } from "./AppShell";

// ─── PageHeader ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  variant: "blue" | "green" | "amber" | "red" | "gray" | "accent";
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? null}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{description}</div>
      {action && (
        action.href ? (
          <a href={action.href} className="btn btn-primary">{action.label}</a>
        ) : (
          <button className="btn btn-primary" onClick={action.onClick}>{action.label}</button>
        )
      )}
    </div>
  );
}

// ─── LoadingState ─────────────────────────────────────────────────────────────

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      <span>{message ?? "Loading..."}</span>
    </div>
  );
}

// ─── ErrorAlert ───────────────────────────────────────────────────────────────

export function ErrorAlert({ title, message, details }: { title: string; message: string; details?: string }) {
  return (
    <div className="error-alert" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <div className="error-alert-title">{title}</div>
        <div className="error-alert-msg">{message}</div>
        {details && (
          <details style={{ marginTop: 8, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", opacity: 0.75 }}>Technical details</summary>
            <pre style={{ marginTop: 8, padding: 8, background: "rgba(0,0,0,.06)", borderRadius: 4, overflow: "auto", fontSize: 11, whiteSpace: "pre-wrap" }}>{details}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── StatusPill ──────────────────────────────────────────────────────────────

export function StatusPill({ status, label, value }: { status: "online" | "offline" | "warn" | "info"; label: string; value?: string }) {
  return (
    <div className={`status-pill ${status}`}>
      <span className="dot" />
      <span className="label">{label}</span>
      {value && <span className="value">{value}</span>}
    </div>
  );
}
