import fs from "node:fs";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext();
const page = await context.newPage();
const events = [];
page.on("pageerror", (e) => events.push("pageerror: " + String(e).slice(0, 200)));
page.on("crash", () => events.push("PAGE CRASHED"));
context.on("close", () => events.push("context closed"));
page.on("close", () => events.push("page closed"));
page.on("console", (m) => { if (m.type() === "error") events.push("console: " + m.text().slice(0, 150)); });

await page.goto("http://localhost:4173/");
await page.getByRole("button", { name: /skip setup/i }).click();
await page.getByRole("button", { name: /nothing different today/i }).click();
await page.goto("http://localhost:4173/#/settings");
await page.waitForTimeout(400);

const download = page.waitForEvent("download");
await page.getByRole("button", { name: /export everything/i }).click();
const file = await download;
const bytes = fs.readFileSync(await file.path());
console.log("export size:", bytes.length);

// Danger zone: wipe (arm + confirm)
await page.getByRole("button", { name: /delete all records permanently/i }).dblclick();
await page.waitForTimeout(2500); // app reloads
console.log("post-wipe onboarding visible:", await page.getByRole("button", { name: /skip setup/i }).isVisible().catch(() => false));
await page.getByRole("button", { name: /skip setup/i }).click().catch(() => {});

// Import the archive back
await page.evaluate(() => { location.hash = "#/settings"; });
await page.waitForTimeout(400);
await page.locator('input[type="file"]').first().setInputFiles({
  name: "afterlight-export.json", mimeType: "application/json", buffer: bytes,
});
await page.waitForTimeout(800);
const mergeVisible = await page.getByRole("button", { name: /merge into my record/i }).isVisible().catch(() => false);
console.log("merge visible:", mergeVisible);
if (mergeVisible) {
  await page.getByRole("button", { name: /merge into my record/i }).click();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    console.log(`t+${(i + 1) * 0.5}s page closed:`, page.isClosed(), "| events:", events.slice(-2));
    if (page.isClosed()) break;
  }
  const alive = !page.isClosed();
  console.log("final alive:", alive);
  if (alive) {
    await page.reload().catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => { location.hash = "#/timeline"; });
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "All time" }).click().catch(() => {});
    console.log("timeline has no-change:", await page.evaluate(() => document.body.innerText.includes("no change today")).catch(() => "page gone"));
    const state = await page.evaluate(async () => {
      const open = () => new Promise((res) => { const r = indexedDB.open("afterlight"); r.onsuccess = () => res(r.result); });
      const db = await open();
      const tx = db.transaction(["dailyLogs", "meta"], "readonly");
      const logs = await new Promise((res) => { const rq = tx.objectStore("dailyLogs").getAll(); rq.onsuccess = () => res(rq.result); });
      const meta = await new Promise((res) => { const rq = tx.objectStore("meta").getAll(); rq.onsuccess = () => res(rq.result); });
      db.close();
      return { logs: logs.length, meta };
    }).catch((e) => String(e).slice(0, 80));
    console.log("IDB state:", JSON.stringify(state));
    console.log("body excerpt:", await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "gone"));
  }
}
console.log("events:", events);
await browser.close();
