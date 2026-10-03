import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
// A: the proven path — My Eyes page, procedure modal
await page.goto("http://localhost:4173/");
await page.getByRole("button", { name: /skip setup/i }).click();
await page.goto("http://localhost:4173/#/my-eyes");
await page.waitForTimeout(800);
const addBtns = page.getByRole("button", { name: /add procedure|procedure/i });
console.log("my-eyes add buttons:", await addBtns.count());
await addBtns.first().click();
await page.waitForTimeout(400);
const modalVisible = await page.getByPlaceholder(/vitrectomy/).isVisible().catch(() => false);
console.log("my-eyes modal visible:", modalVisible);
if (modalVisible) {
  await page.getByPlaceholder(/vitrectomy/).fill("MyEyes test procedure");
  await page.locator('input[type="date"]').first().fill("2024-02-01");
  await page.getByRole("button", { name: /save/i }).click();
  await page.waitForTimeout(1000);
  console.log("my-eyes body shows it:", await page.evaluate(() => document.body.innerText.includes("MyEyes test procedure")));
}
// B: the timeline inline path
await page.goto("http://localhost:4173/#/timeline");
await page.waitForTimeout(800);
await page.getByRole("button", { name: "+ Add event" }).click();
await page.getByRole("button", { name: /Procedure or surgery/ }).click();
await page.waitForTimeout(400);
await page.getByPlaceholder(/vitrectomy/).fill("Timeline test procedure");
await page.locator('input[type="date"]').first().fill("2024-03-01");
await page.getByRole("button", { name: /save/i }).click();
await page.waitForTimeout(1200);
console.log("timeline body shows it:", await page.evaluate(() => document.body.innerText.includes("Timeline test procedure")));
console.log("modal still open:", await page.getByPlaceholder(/vitrectomy/).isVisible().catch(() => false));
console.log("errors:", errors.slice(0, 4));
await browser.close();
