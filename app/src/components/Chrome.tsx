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

/**
 * A small disclosure on the native popover API: `popover="auto"` + `popovertarget` give light
 * dismiss, Escape, one-open-at-a-time and focus back to the button, and the top layer means no
 * ancestor's overflow, blur or stacking context can clip it.
 */
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
  // Mirrors the native open state for aria-expanded.
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const centred = panelClass?.split(" ").includes("center") ?? false;

  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    // In the top layer the panel is positioned against the viewport, not its button, so it is
    // placed from the button's box. CSS anchor positioning would do this, but only Safari 27 has it.
    const place = () => {
      const b = button.current?.getBoundingClientRect();
      if (!b) return;
      p.style.top = `${b.bottom + 10}px`;
      // A fixed box cannot be reached by scrolling the page, so at the largest text sizes the
      // panel scrolls inside itself instead of running off the bottom of the screen.
      p.style.maxHeight = `calc(100dvh - ${b.bottom + 26}px)`;
      if (centred) {
        p.style.left = `${b.left + b.width / 2}px`;
        p.style.right = "auto";
      } else {
        p.style.right = `${document.documentElement.clientWidth - b.right}px`;
        p.style.left = "auto";
      }
    };
    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") place();
    };
    const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
    p.addEventListener("beforetoggle", onBeforeToggle);
    p.addEventListener("toggle", onToggle);
    window.addEventListener("resize", place);
    return () => {
      p.removeEventListener("beforetoggle", onBeforeToggle);
      p.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", place);
    };
  }, [centred]);

  const close = () => panel.current?.hidePopover();

  return (
    <>
      <button
        ref={button}
        className={buttonClass}
        aria-expanded={open}
        aria-controls={id}
        aria-label={showLabel ? undefined : label}
        title={showLabel ? undefined : label}
        // React 18's types predate the popover attributes; the DOM receives them as written.
        {...({ popovertarget: id } as object)}
      >
        <Icon name={icon} />
        {showLabel && <span className="dock-label">{label}</span>}
      </button>
      <div
        id={id}
        ref={panel}
        className={`popover glass ${panelClass ?? ""}`}
        {...({ popover: "auto" } as object)}
      >
        {/* Always rendered: a closed popover is display: none and out of the accessibility tree
            already, and content rendered on open would paint the panel empty for a frame. */}
        {children(close)}
      </div>
    </>
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
