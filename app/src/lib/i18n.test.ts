import { describe, expect, it } from "vitest";
import { EN } from "./locales/en";
import {
  EN_LOCALE,
  LOCALES,
  bestLocale,
  currentLocale,
  missingKeys,
  setLocale,
  t,
  type Locale,
} from "./i18n";
import { EYE_LABELS, EYE_SHORT, SOURCE_LABELS, type SourceType } from "./models";

describe("the message catalogue", () => {
  it("has a real string behind every key", () => {
    for (const [key, value] of Object.entries(EN)) {
      expect(value, key).toBeTruthy();
      expect(value.trim(), key).toBe(value);
    }
  });

  it("keeps provenance and eye labels as one definition", () => {
    // Two copies of "Patient reported" would drift, and the copy that drifts is the one on screen.
    for (const source of Object.keys(SOURCE_LABELS) as SourceType[]) {
      expect(t(`source.${source}`)).toBe(SOURCE_LABELS[source]);
    }
    expect(t("eye.right")).toBe(EYE_LABELS.right);
    expect(t("eye.short.left")).toBe(EYE_SHORT.left);
  });

  it("never uses a tone this app does not use", () => {
    for (const [key, value] of Object.entries(EN)) {
      expect(value, key).not.toMatch(/!/);
      expect(value, key).not.toMatch(/\b(great|awesome|amazing|well done|congratulations)\b/i);
      // Streak language was removed deliberately in the daily-loop phase; it must not creep back
      // in through a string.
      expect(value, key).not.toMatch(/\b(streak|keep it up|don't break)\b/i);
    }
  });

  it("carries the safety wording verbatim, so one edit changes every screen", () => {
    expect(t("safety.urgent")).toMatch(/ophthalmologist or emergency eye service/);
    expect(t("safety.urgent")).toMatch(/Afterlight cannot determine the cause/);
    expect(t("safety.settings_notice")).toMatch(/ophthalmologist or emergency eye service/);
  });
});

describe("looking a message up", () => {
  it("fills placeholders", () => {
    expect(t("eye.label", { eye: "Right (OD)" })).toBe("Eye: Right (OD)");
  });

  it("leaves an unfilled placeholder visible rather than printing undefined", () => {
    expect(t("eye.label", {})).toBe("Eye: {eye}");
  });

  it("falls back to English rather than showing a key", () => {
    const partial: Locale = { id: "xx", label: "Test", messages: { "nav.today": "Heddiw" } };
    LOCALES.push(partial);
    try {
      setLocale("xx");
      expect(t("nav.today")).toBe("Heddiw");
      // A key nobody has translated yet still reads as a sentence. A person seeing
      // "today.nothing_different" on screen has been failed twice.
      expect(t("today.nothing_different")).toBe(EN["today.nothing_different"]);
      expect(missingKeys(partial).length).toBe(Object.keys(EN).length - 1);
    } finally {
      setLocale("en");
      LOCALES.pop();
    }
  });

  it("defaults to English and stays there for an unknown language", () => {
    setLocale("klingon");
    expect(currentLocale()).toBe(EN_LOCALE);
    expect(t("nav.today")).toBe("Today");
  });
});

describe("choosing a language for a browser", () => {
  it("matches a region variant to its base language", () => {
    const pt: Locale = { id: "pt", label: "Português", messages: {} };
    LOCALES.push(pt);
    try {
      expect(bestLocale(["pt-BR", "en"])).toBe(pt);
      expect(bestLocale(["en-GB"])).toBe(EN_LOCALE);
      expect(bestLocale(["de", "fr"])).toBe(EN_LOCALE);
    } finally {
      LOCALES.pop();
    }
  });

  it("ships English only for now", () => {
    expect(LOCALES.map((l) => l.id)).toEqual(["en"]);
    expect(missingKeys(EN_LOCALE)).toEqual([]);
  });
});
