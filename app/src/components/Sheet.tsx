import { useEffect, useRef, type ReactNode } from "react";

/**
 * A bottom sheet on small screens, a centred dialog on large ones.
 *
 * Same accessibility contract as `Modal`: focus moves in, Tab stays inside, Escape closes, and
 * focus returns to whatever opened it.
 */
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    (ref.current?.querySelector<HTMLElement>("button, a, input, select, textarea") ?? ref.current)?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      const opener = openerRef.current;
      if (opener && document.body.contains(opener)) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop">
      <button
        type="button"
        className="backdrop-dismiss"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn subtle" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
