import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { DEFAULT_PREFS, THEMES, THEME_CACHE_KEY, THEME_COLOR, applyPrefs } from "./prefs";

const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

afterEach(() => {
  localStorage.clear();
  document.head.querySelector('meta[name="theme-color"]')?.remove();
});

it("gives the browser toolbar the colour of the theme in use", () => {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  for (const { id } of THEMES) {
    applyPrefs({ ...DEFAULT_PREFS, theme: id }, document.documentElement);
    expect(meta.getAttribute("content")).toBe(THEME_COLOR[id]);
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe(id);
  }
});

it("keeps the toolbar colours equal to each theme's page ground", () => {
  const rootBg = css.match(/:root\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i)?.[1];
  expect(THEME_COLOR.dark).toBe(rootBg);
  for (const id of ["light", "hc-dark", "hc-light"] as const) {
    const bg = css.match(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{[^}]*?--bg:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
    expect(THEME_COLOR[id]).toBe(bg);
  }
});

it("restores the same themes and colours before first paint as the app applies", () => {
  // The inline script in index.html cannot import prefs.ts, so its copy is checked here.
  for (const { id } of THEMES) {
    const key = id.includes("-") ? `"${id}"` : id;
    expect(html).toContain(`${key}: "${THEME_COLOR[id]}"`);
  }
  expect(html).toContain(`localStorage.getItem("${THEME_CACHE_KEY}")`);
  expect(html).toContain(`data-theme="${DEFAULT_PREFS.theme}"`);
  expect(html).toContain(`<meta name="theme-color" content="${THEME_COLOR[DEFAULT_PREFS.theme]}" />`);
  expect(html).toMatch(/<meta name="color-scheme" content="light dark" \/>/);
});
