// Display preferences.
//
// These are not cosmetic. The people using Afterlight have retinal disease, field loss, glare
// sensitivity and acuity that changes day to day; the type scale and contrast theme decide
// whether the app is usable at all. They live in the record so they survive an export/import.

import type { AppMeta } from "./models";

export type ThemeId = "dark" | "light" | "hc-dark" | "hc-light";

export const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: "dark", label: "Dark", description: "Low light, gentle contrast." },
  { id: "light", label: "Light", description: "Paper-like, gentle contrast." },
  { id: "hc-dark", label: "High contrast dark", description: "White on black, maximum separation." },
  { id: "hc-light", label: "High contrast light", description: "Black on white, maximum separation." },
];

export const TYPE_SCALES = [
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Large" },
  { value: 1.5, label: "Larger" },
  { value: 2, label: "Largest" },
] as const;

export type TypeScale = (typeof TYPE_SCALES)[number]["value"];

export interface DisplayPrefs {
  theme: ThemeId;
  typeScale: TypeScale;
  reducedMotion: boolean;
  glareComfort: boolean;
  dimImagery: boolean;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  theme: "dark",
  typeScale: 1,
  reducedMotion: false,
  glareComfort: false,
  dimImagery: false,
};

export function prefsFromMeta(meta?: AppMeta): DisplayPrefs {
  return {
    theme: (meta?.theme as ThemeId) ?? DEFAULT_PREFS.theme,
    typeScale: (meta?.type_scale as TypeScale) ?? DEFAULT_PREFS.typeScale,
    reducedMotion: meta?.reduced_motion ?? DEFAULT_PREFS.reducedMotion,
    glareComfort: meta?.glare_comfort ?? DEFAULT_PREFS.glareComfort,
    dimImagery: meta?.dim_imagery ?? DEFAULT_PREFS.dimImagery,
  };
}

/** Apply preferences to the document. Idempotent, and safe to call on every change. */
export function applyPrefs(prefs: DisplayPrefs, root: HTMLElement): void {
  root.setAttribute("data-theme", prefs.theme);
  root.style.setProperty("--type-scale", String(prefs.typeScale));
  if (prefs.reducedMotion) root.setAttribute("data-motion", "reduced");
  else root.removeAttribute("data-motion");
  if (prefs.glareComfort) root.setAttribute("data-glare", "comfort");
  else root.removeAttribute("data-glare");
  if (prefs.dimImagery) root.setAttribute("data-imagery", "dimmed");
  else root.removeAttribute("data-imagery");
}

export function isHighContrast(theme: ThemeId): boolean {
  return theme === "hc-dark" || theme === "hc-light";
}
