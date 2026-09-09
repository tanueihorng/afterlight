// Translation.
//
// Eye disease is not an English-speaking condition, and someone reading about their own retina at
// 2am should not have to do it in a second language. This is the layer that makes another language
// possible without a rewrite. Only English ships — see `docs/translating.md`.
//
// Two deliberate limits:
//
//   * It is a lookup, not a framework. No plural rules engine, no ICU parser, no lazy-loaded
//     bundles. The whole English catalogue is about 4 KB and lives in the initial chunk, because a
//     person's first screen should not wait on a fetch that this app is not allowed to make anyway.
//
//   * The boundary statements are *not* moved here. `SELF_TEST_BOUNDARY`,
//     `GENERIC_MODEL_BOUNDARY`, `SIMULATION_BOUNDARY`, `PATIENT_GENERATED_FOOTER`, `QR_BOUNDARY`,
//     `OCR_BOUNDARY` and the not-found sentence stay next to the code that uses them, where the
//     invariant guard already checks them. The catalogue re-exports them so a translator still
//     finds every string in one place, but moving the definitions would silently disarm those
//     checks — a real cost for a cosmetic tidiness.

import { EN, type Catalogue, type MessageKey } from "./locales/en";

export type { Catalogue, MessageKey };

export interface Locale {
  id: string;
  /** The language's own name for itself, which is what a person looks for in a list. */
  label: string;
  messages: Partial<Catalogue>;
  /** Right-to-left scripts need the document direction set. */
  dir?: "ltr" | "rtl";
}

export const EN_LOCALE: Locale = { id: "en", label: "English", messages: EN, dir: "ltr" };

/**
 * Every language the build carries. English only, for now — a half-translated medical app is
 * worse than an English one, because the half a person needs is never the half that was done.
 */
export const LOCALES: Locale[] = [EN_LOCALE];

let current: Locale = EN_LOCALE;

export function setLocale(id: string): Locale {
  current = LOCALES.find((l) => l.id === id) ?? EN_LOCALE;
  if (typeof document !== "undefined") {
    document.documentElement.lang = current.id;
    document.documentElement.dir = current.dir ?? "ltr";
  }
  return current;
}

export function currentLocale(): Locale {
  return current;
}

/**
 * Pick the closest available language for a browser, falling back to English.
 * `pt-BR` matches a `pt` catalogue; nothing matches nothing, and that is fine.
 */
export function bestLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const exact = LOCALES.find((l) => l.id.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split("-")[0].toLowerCase();
    const loose = LOCALES.find((l) => l.id.split("-")[0].toLowerCase() === base);
    if (loose) return loose;
  }
  return EN_LOCALE;
}

/**
 * Look up a message.
 *
 * An untranslated key falls through to English rather than showing the key, because a person
 * seeing `today.nothing_different` on a screen has been failed twice.
 *
 * `{name}` placeholders are replaced from `vars`. A placeholder with no value is left as written,
 * so the gap is visible to whoever is testing rather than rendering as "undefined".
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const message = current.messages[key] ?? EN[key];
  if (vars === undefined) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Keys a locale has not translated yet. Used by the tests and by `npm run i18n`. */
export function missingKeys(locale: Locale): MessageKey[] {
  return (Object.keys(EN) as MessageKey[]).filter((key) => !(key in locale.messages));
}
