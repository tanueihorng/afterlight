import { useId, useRef, type ReactNode } from "react";
import { useNativeDialog } from "./ui";

/**
 * A bottom sheet on small screens, a centred dialog on large ones.
 *
 * Same contract as `Modal`, from the native `<dialog>`: focus moves in, Tab stays inside, Escape
 * or a tap on the dimmed backdrop closes, and focus returns to whatever opened it.
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useNativeDialog(ref, onClose);

  return (
    <dialog className="sheet" aria-labelledby={titleId} ref={ref}>
      <div className="sheet-grip" aria-hidden />
      <div className="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button className="btn subtle modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
