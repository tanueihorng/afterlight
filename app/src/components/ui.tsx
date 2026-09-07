import { useEffect, useRef, type ReactNode } from "react";
import { EYE_SHORT, SOURCE_LABELS, type Eye, type SourceType } from "../lib/models";

export function ProvenanceBadge({ source }: { source: SourceType }) {
  return <span className={`badge source-${source}`}>{SOURCE_LABELS[source]}</span>;
}

export function EyeBadge({ eye }: { eye: Eye }) {
  if (eye === "not_applicable") return null;
  return (
    <span className={`badge eye-${eye}`} aria-label={`Eye: ${EYE_SHORT[eye]}`}>
      {EYE_SHORT[eye]}
    </span>
  );
}

export function DemoBadge({ demo }: { demo?: boolean }) {
  if (!demo) return null;
  return <span className="badge demo">Demo data</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = ["new", "same", "better", "worse", "resolved"].includes(status) ? status : "same";
  return <span className={`badge status-${cls}`}>{status}</span>;
}

export function SafetyNotice({ children }: { children: ReactNode }) {
  return (
    <div className="safety" role="note" aria-live="polite">
      <span className="safety-icon" aria-hidden>
        ◇
      </span>
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      <div className="empty-body">{children}</div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // focus first focusable for keyboard users
    const first = ref.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not(.modal-close)"
    );
    first?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      {/* Mouse convenience only — keyboard users close with Escape or the close button. */}
      <button
        type="button"
        className="backdrop-dismiss"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? { maxWidth: 860 } : undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>{title}</h2>
          <button className="btn subtle modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function EyeSelect({
  value,
  onChange,
  allowBoth = true,
  id,
}: {
  value: Eye;
  onChange: (e: Eye) => void;
  allowBoth?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Eye)}
      aria-label="Eye"
    >
      <option value="right">Right Eye (OD)</option>
      <option value="left">Left Eye (OS)</option>
      {allowBoth && <option value="both">Both Eyes (OU)</option>}
    </select>
  );
}

export function SourceSelect({
  value,
  onChange,
}: {
  value: SourceType;
  onChange: (s: SourceType) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SourceType)} aria-label="Source of information">
      {(Object.keys(SOURCE_LABELS) as SourceType[])
        .filter((s) => s !== "ai_generated")
        .map((s) => (
          <option key={s} value={s}>
            {SOURCE_LABELS[s]}
          </option>
        ))}
    </select>
  );
}

export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirm delete?",
  className = "btn danger",
}: {
  onConfirm: () => void;
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={(e) => {
        const btn = e.currentTarget;
        if (btn.dataset.armed === "1") {
          onConfirm();
        } else {
          btn.dataset.armed = "1";
          btn.textContent = confirmLabel;
          setTimeout(() => {
            btn.dataset.armed = "0";
            btn.textContent = label;
          }, 2600);
        }
      }}
    >
      {label}
    </button>
  );
}

export function PageHeader({
  kicker,
  title,
  sub,
  actions,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {kicker && <div className="topbar-date">{kicker}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h1>{title}</h1>
        {actions && <div className="btn-row">{actions}</div>}
      </div>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}
