import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ACCENTS, prefsFromMeta, type AccentId, type ThemeId } from "../lib/prefs";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

/**
 * The floating dock. A single "blob" slides under whichever item the pointer or keyboard is on
 * and settles back on the current page — the one piece of motion that says where you are.
 */
export function Dock({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const blob = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState(false);

  const place = (target?: HTMLElement | null) => {
    const nav = ref.current;
    const el = target ?? nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !blob.current) return;
    nav
      .querySelectorAll(".dock-item")
      .forEach((item) => item.classList.toggle("under", item === el));
    if (!el || !el.offsetWidth) {
      blob.current.style.width = "0px";
      return;
    }
    blob.current.style.width = `${el.offsetWidth}px`;
    blob.current.style.height = `${el.offsetHeight}px`;
    blob.current.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    setMeasured(true);
  };

  // Re-measure after every render: the current page, the language and the text size all move it.
  useLayoutEffect(() => place());

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !ref.current) return;
    const observer = new ResizeObserver(() => place());
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const over = (e: SyntheticEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(".dock-item");
    if (item) place(item);
  };

  return (
    <nav
      ref={ref}
      className={`dock glass ${measured ? "has-blob" : ""}`}
      aria-label={label}
      onPointerOver={over}
      onFocus={over}
      onPointerLeave={() => place()}
      onBlur={() => place()}
    >
      <span ref={blob} className="dock-blob" aria-hidden="true" />
      {children}
    </nav>
  );
}

/** A small disclosure that closes on Escape or a click elsewhere, and returns focus when it does. */
export function Popover({
  label,
  icon,
  buttonClass,
  panelClass,
  children,
  showLabel,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  buttonClass: string;
  panelClass?: string;
  showLabel?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover-anchor" ref={wrap}>
      <button
        ref={button}
        className={buttonClass}
        aria-expanded={open}
        aria-controls={id}
        aria-label={showLabel ? undefined : label}
        title={showLabel ? undefined : label}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={icon} />
        {showLabel && <span className="dock-label">{label}</span>}
      </button>
      {open && (
        <div id={id} className={`popover glass ${panelClass ?? ""}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Colour, light or dark, glass or solid — the choices people make for comfort and for taste. */
export function AppearancePanel({ onMore }: { onMore: () => void }) {
  const store = useStore();
  const prefs = prefsFromMeta(store.meta);
  const highContrast = prefs.theme === "hc-dark" || prefs.theme === "hc-light";

  const setTheme = (theme: ThemeId) => store.setMeta({ theme });

  return (
    <>
      <h2>Appearance</h2>
      <div>
        <div className="field-label" id="appearance-mode">
          Light or dark
        </div>
        <div className="seg" role="group" aria-labelledby="appearance-mode">
          <button aria-pressed={prefs.theme === "light"} onClick={() => setTheme("light")}>
            <Icon name="sun" size={16} /> Light
          </button>
          <button aria-pressed={prefs.theme === "dark"} onClick={() => setTheme("dark")}>
            <Icon name="moon" size={16} /> Dark
          </button>
        </div>
      </div>
      <div>
        <div className="field-label" id="appearance-colour">
          Colour
        </div>
        {highContrast ? (
          <p className="muted" style={{ margin: 0 }}>
            High contrast is on, so colours stay fixed. Choose Light or Dark to use a colour.
          </p>
        ) : (
          <div className="swatches" role="group" aria-labelledby="appearance-colour">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className="swatch"
                aria-pressed={prefs.accent === a.id}
                title={a.description}
                onClick={() => store.setMeta({ accent: a.id as AccentId })}
              >
                <span className={`swatch-dot swatch-${a.id}`}>
                  {prefs.accent === a.id && <Icon name="check" />}
                </span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="field-label" id="appearance-surface">
          Surfaces
        </div>
        <div className="seg" role="group" aria-labelledby="appearance-surface">
          <button
            aria-pressed={!prefs.solidSurfaces}
            onClick={() => store.setMeta({ solid_surfaces: false })}
          >
            Glass
          </button>
          <button
            aria-pressed={prefs.solidSurfaces}
            onClick={() => store.setMeta({ solid_surfaces: true })}
          >
            Solid
          </button>
        </div>
      </div>
      <button className="btn subtle" onClick={onMore}>
        Text size, contrast and comfort <Icon name="arrow" size={16} />
      </button>
    </>
  );
}

/**
 * Two small touches that make the glass feel like a material: a soft light that follows the
 * pointer across cards, and a ripple where a button is pressed. Neither carries meaning, and the
 * ripple never runs for anyone who has asked for less motion.
 */
export function useFluidSurfaces() {
  useEffect(() => {
    const LIT = ".card, .decision-btn";
    let frame = 0;
    let last: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(LIT) ?? null;
        if (last && last !== el) {
          last.style.removeProperty("--mx");
          last.style.removeProperty("--my");
        }
        last = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };

    const calm = () =>
      document.documentElement.getAttribute("data-motion") === "reduced" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const onDown = (e: PointerEvent) => {
      if (calm()) return;
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(
        ".btn, .decision-btn, .quick-btn",
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "ripple";
      dot.setAttribute("aria-hidden", "true");
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      el.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove());
      window.setTimeout(() => dot.remove(), 1200);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);
}
