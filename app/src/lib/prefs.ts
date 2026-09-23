// Display preferences.
//
// These are not cosmetic. The people using Afterlight have retinal disease, field loss, glare
// sensitivity and acuity that changes day to day; the type scale and contrast theme decide
// whether the app is usable at all. They live in the record so they survive an export/import.

import type { AppMeta } from "./models";

export type ThemeId = "dark" | "light" | "hc-dark" | "hc-light";

export const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: "light", label: "Light", description: "Soft daylight glass, gentle contrast." },
  { id: "dark", label: "Dark", description: "Night glass, low light." },
  {
    id: "hc-dark",
    label: "High contrast dark",
    description: "White on black, maximum separation.",
  },
  {
    id: "hc-light",
    label: "High contrast light",
    description: "Black on white, maximum separation.",
  },
];

export type AccentId =
  "dusk" | "ocean" | "blossom" | "sunrise" | "lagoon" | "aurora" | "sorbet" | "moonstone";

/**
 * Colour themes, three colours each. Purely a matter of taste: none of them means anything, none
 * is used for eyes or provenance, and the high-contrast themes ignore them so their ratios never move.
 */
export const ACCENTS: { id: AccentId; label: string; description: string }[] = [
  { id: "dusk", label: "Dusk", description: "Periwinkle, lilac and peach." },
  { id: "ocean", label: "Ocean", description: "Sky blue, iris and sea glass." },
  { id: "blossom", label: "Blossom", description: "Pink, lilac and apricot." },
  { id: "sunrise", label: "Sunrise", description: "Peach, gold and rose." },
  { id: "lagoon", label: "Lagoon", description: "Aqua, blue and mint." },
  { id: "aurora", label: "Aurora", description: "Mint, violet and pink." },
  { id: "sorbet", label: "Sorbet", description: "Coral, pink and lavender." },
  { id: "moonstone", label: "Moonstone", description: "Silver, slate and heather." },
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
  accent: AccentId;
  solidSurfaces: boolean;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  theme: "light",
  typeScale: 1,
  reducedMotion: false,
  glareComfort: false,
  dimImagery: false,
  accent: "dusk",
  solidSurfaces: false,
};

export function prefsFromMeta(meta?: AppMeta): DisplayPrefs {
  return {
    theme: (meta?.theme as ThemeId) ?? DEFAULT_PREFS.theme,
    typeScale: (meta?.type_scale as TypeScale) ?? DEFAULT_PREFS.typeScale,
    reducedMotion: meta?.reduced_motion ?? DEFAULT_PREFS.reducedMotion,
    glareComfort: meta?.glare_comfort ?? DEFAULT_PREFS.glareComfort,
    dimImagery: meta?.dim_imagery ?? DEFAULT_PREFS.dimImagery,
    accent: ACCENTS.some((a) => a.id === meta?.accent)
      ? (meta!.accent as AccentId)
      : DEFAULT_PREFS.accent,
    solidSurfaces: meta?.solid_surfaces ?? DEFAULT_PREFS.solidSurfaces,
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
  root.setAttribute("data-accent", prefs.accent);
  if (prefs.solidSurfaces) root.setAttribute("data-surfaces", "solid");
  else root.removeAttribute("data-surfaces");
}

export function isHighContrast(theme: ThemeId): boolean {
  return theme === "hc-dark" || theme === "hc-light";
}
