import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { SOURCE_LABELS, type Eye, type SourceType } from "../lib/models";
import { t } from "../lib/i18n";

/**
 * Where focus starts in a dialog. An explicit `autofocus` first; then the first form field, which
 * is where someone wants to start typing; otherwise the dialog's heading, so a screen reader
 * begins with what the dialog is. Never a button: in a record's detail view the first button is
 * often Delete, and focus should not start two key presses from losing a record.
 */
function focusStart(dialog: HTMLDialogElement) {
  const target =
    dialog.querySelector<HTMLElement>("[autofocus]:not([disabled])") ??
    dialog.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
    ) ??
    dialog.querySelector<HTMLElement>("h1, h2");
  if (!target) return; // showModal() has already focused the first focusable control.
  if (/^H[12]$/.test(target.tagName) && !target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus();
}

/**
 * The dialog contract, on the platform's own `<dialog>`: `showModal()` puts it in the top layer,
 * makes the rest of the page inert (to the keyboard and to a screen reader's virtual cursor),
 * keeps Tab inside, and turns Escape or the phone's back gesture into a `cancel` event. Only the
 * innermost of stacked dialogs receives it, so one Escape never closes two.
 *
 * React owns open and closed: the dialog opens when it mounts and closes when it unmounts, and
 * every way of dismissing it goes through `onClose`.
 *
 * - `escape: false` — Escape and back do nothing (onboarding: leaving it writes records).
 * - `lightDismiss: false` — a click on the dimmed backdrop does nothing.
 */
export function useNativeDialog(
  ref: RefObject<HTMLDialogElement | null>,
  onClose: () => void,
  opts?: { escape?: boolean; lightDismiss?: boolean },
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const escape = opts?.escape !== false;
  const lightDismiss = opts?.lightDismiss !== false;

  // A layout effect: its cleanup runs while the dialog is still in the document, so close()
  // can hand focus back before React removes the node.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    // A dialog nobody may dismiss says so to the browser too (Chromium, Firefox), so a first
    // Escape before any click — when `cancel` cannot be prevented — does not close it at all.
    if (!escape && !lightDismiss) dialog.setAttribute("closedby", "none");
    if (!dialog.open) dialog.showModal();
    focusStart(dialog);

    // Where focus was inside the dialog, so a forced reopen can put it back.
    let lastFocus: HTMLElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      lastFocus = e.target as HTMLElement;
    };

    // Set when Escape was already handled, so the `close` that follows a cancel the browser
    // would not let us prevent does not run onClose a second time (in the presentation view,
    // that would back out of a zoom and then leave it in one key press).
    let handledByCancel = false;
    const onCancel = (e: Event) => {
      // Keep the element open; React closes it by unmounting once onClose has run.
      e.preventDefault();
      if (escape) {
        handledByCancel = !e.defaultPrevented;
        onCloseRef.current();
      }
    };

    // Browsers may close a dialog despite preventDefault (repeated Escape with no user
    // activation in between). Treat that as a dismissal; if the owner keeps the dialog mounted
    // (onboarding, or a presentation that only backed out of a zoom), open it again so it is
    // never left in the tree but invisible.
    let unmounting = false;
    const onNativeClose = () => {
      // `close` is queued, not synchronous: one left over from an earlier close() (React's
      // StrictMode mounts, unmounts and remounts) can arrive after the dialog has reopened.
      if (unmounting || dialog.open) return;
      if (escape && !handledByCancel) onCloseRef.current();
      handledByCancel = false;
      requestAnimationFrame(() => {
        if (unmounting || !dialog.isConnected || dialog.open) return;
        dialog.showModal();
        if (lastFocus?.isConnected && dialog.contains(lastFocus)) lastFocus.focus();
        else focusStart(dialog);
      });
    };

    // Click outside, by pointer position: a press on ::backdrop targets the dialog itself, and
    // so does one on the dialog's own padding, so the target alone cannot tell them apart. Both
    // press and release must land outside, so a text selection dragged past the edge does not
    // close it. This also covers Safari, which has no `closedby`.
    const outside = (e: PointerEvent) => {
      if (e.target !== dialog) return false;
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = outside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (lightDismiss && pressedOutside && outside(e)) onCloseRef.current();
      pressedOutside = false;
    };

    dialog.addEventListener("focusin", onFocusIn);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      unmounting = true;
      dialog.removeEventListener("focusin", onFocusIn);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
      if (dialog.open) dialog.close();
      // close() restores focus to the opener in current browsers. Where it did not, do it here,
      // so focus never falls back to the top of the page.
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || dialog.contains(active))) {
        opener.focus();
      }
    };
    // Mount/unmount only. Re-running on every parent render would yank focus back to the first
    // field while someone is halfway through typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

export function ProvenanceBadge({ source }: { source: SourceType }) {
  return <span className={`badge source-${source}`}>{t(`source.${source}`)}</span>;
}

export function EyeBadge({ eye }: { eye: Eye }) {
  if (eye === "not_applicable") return null;
  return (
    <span
      className={`badge eye-${eye}`}
      aria-label={t("eye.label", { eye: t(`eye.short.${eye}`) })}
    >
      {t(`eye.short.${eye}`)}
    </span>
  );
}

/**
 * A record whose details were read out of a file and have not been checked by the person.
 *
 * It says what is true — nobody has looked at this yet — rather than warning about it, and it is
 * the visible counterpart of the rule that keeps unchecked extractions out of a brief.
 */
export function NeedsCheckingBadge({
  source,
  confirmed,
}: {
  source: SourceType;
  confirmed?: boolean;
}) {
  if (source !== "document_extracted" || confirmed) return null;
  return <span className="badge needs-checking">{t("source.not_checked")}</span>;
}

export function DemoBadge({ demo }: { demo?: boolean }) {
  if (!demo) return null;
  return <span className="badge demo">{t("eye.demo")}</span>;
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useNativeDialog(ref, onClose);

  return (
    <dialog
      className="modal"
      aria-labelledby={titleId}
      ref={ref}
      style={wide ? { maxWidth: 860 } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 id={titleId}>{title}</h2>
        <button className="btn subtle modal-close" onClick={onClose} aria-label="Close dialog">
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SourceType)}
      aria-label="Source of information"
    >
      {(Object.keys(SOURCE_LABELS) as SourceType[])
        .filter((s) => s !== "ai_generated")
        .map((s) => (
          <option key={s} value={s}>
            {t(`source.${s}`)}
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <h1>{title}</h1>
        {actions && <div className="btn-row">{actions}</div>}
      </div>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}
