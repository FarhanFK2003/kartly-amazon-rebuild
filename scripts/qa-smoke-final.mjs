// Final evaluator smoke test: the twelve checks the brief lists, nothing more.
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });
const problems = [];
let n = 0;
const check = (name, ok, detail = "") => { n++; if (!ok) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
p.on("console", (m) => { if (m.type() === "error" && !/DevTools|preload/.test(m.text())) errs.push(m.text().slice(0, 140)); });

// 1-2 build + homepage
await p.goto(BASE, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
check("homepage loads", /Shop by department/.test((await p.locator("main").textContent()) || ""));

// 3 search
await p.locator('input[name="q"]').first().fill("camera");
await p.keyboard.press("Enter");
await p.waitForURL(/\/s\?/, { timeout: 15000 });
await p.waitForTimeout(800);
check("search returns results", (await p.locator("a[href^='/dp/']").count()) > 0);

// 4 open a product
await p.locator("a[href^='/dp/']").first().click();
await p.waitForURL(/\/dp\//, { timeout: 15000 });
await p.waitForTimeout(800);
check("product page opens", (await p.locator("h1").count()) > 0);

// 5-6 add to cart + drawer
await p.getByRole("button", { name: /^Add to Cart$/ }).first().click();
await p.waitForTimeout(800);
const drawer = p.locator('div[role="dialog"][aria-label="Shopping cart"]');
check("add to cart opens the drawer", await drawer.isVisible());
check("cart badge updates", /Cart, 1 item/.test((await p.locator("a[aria-label^='Cart,']").first().getAttribute("aria-label")) || ""));

// 7 cart
await drawer.getByRole("link", { name: "Go to Cart" }).click();
await p.waitForURL(/\/cart/, { timeout: 15000 });
await p.waitForTimeout(800);
check("cart page shows the item", /Subtotal/i.test((await p.locator("main").textContent()) || ""));

// 8 checkout
await p.getByRole("link", { name: /Proceed to checkout/i }).first().click();
await p.waitForURL(/\/checkout/, { timeout: 15000 });
await p.waitForTimeout(700);
await p.getByLabel(/Full name/i).fill("Ada Lovelace");
await p.getByLabel(/Street address/i).fill("12 Analytical Way");
await p.getByLabel(/^City/i).fill("San Francisco");
await p.locator("select").first().selectOption({ index: 5 });
await p.getByLabel(/ZIP/i).fill("94103");
await p.getByLabel(/Phone/i).fill("5550192837");
await p.screenshot({ path: `${OUT}/checkout-row.png` });
await p.getByRole("button", { name: /Use this address/i }).click();
await p.waitForTimeout(600);
await p.getByText("Credit or debit card").click().catch(() => {});
await p.waitForTimeout(300);
const card = p.getByLabel(/Card number/i);
if (await card.count()) {
  await card.fill("4111111111111111");
  await p.getByLabel(/Name on card/i).fill("Ada Lovelace").catch(() => {});
  await p.getByLabel(/Expiry|MM \/ YY/i).fill("12/29").catch(() => {});
  await p.getByLabel(/CVV|Security/i).fill("123").catch(() => {});
}
await p.getByRole("button", { name: /Use this payment method/i }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /Place your order/i }).first().click();
await p.waitForURL(/order-confirmation/, { timeout: 20000 });
await p.waitForTimeout(900);
check("checkout completes", /order-confirmation/.test(p.url()));

// 9 confirmation
const conf = (await p.locator("main").textContent()) || "";
check("confirmation shows an order number", /KTL-/.test(conf));
check("cart cleared after order", /Cart, 0 items/.test((await p.locator("a[aria-label^='Cart,']").first().getAttribute("aria-label")) || ""));

// 10 orders
await p.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(800);
check("orders page lists the order", /KTL-/.test((await p.locator("main").textContent()) || ""));

// 11 mobile homepage
const mp = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await mp.goto(BASE, { waitUntil: "domcontentloaded" });
await mp.waitForTimeout(1000);
const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
check("mobile homepage loads without overflow", sw <= 391, `scrollWidth ${sw}`);

// 12 console health
check("no console or page errors", errs.length === 0, errs.join(" | "));

await b.close();
console.log(`\n${n - problems.length}/${n} smoke checks passed`);
if (problems.length) { console.log("\nPROBLEMS:"); problems.forEach((x) => console.log("  " + x)); process.exitCode = 1; }
