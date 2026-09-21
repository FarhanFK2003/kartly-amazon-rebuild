// QA for the simulated sign-in: validation, session persistence, header state,
// sign out, and the guarantee that shopping still works signed out.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
}

function attach(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (/React DevTools|_next\/hmr|WebSocket|status of 400|status of 404|preloaded using link preload/.test(t)) return;
    problems.push(`[${label}] console.${m.type()}: ${t.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${String(e).slice(0, 200)}`));
}

const headerText = (page) => page.locator("header").first().textContent();

/**
 * Opens the account menu and waits for it, scoped to the account area.
 * The department drawer also contains a Sign out control, so an unscoped
 * lookup is ambiguous, and a fixed sleep is flaky.
 */
async function openAccountMenu(page) {
  const area = page.locator('[data-testid="account-area"]');
  if ((await area.locator('[role="menu"]').count()) === 0) {
    await area.locator("button").first().click();
  }
  await area.locator('[role="menu"]').first().waitFor({ state: "visible", timeout: 10000 });
  return area;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page, "desktop");

/* ---- direct /signin ---- */
const res = await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(page);
check("direct /signin returns 200", res?.status() === 200, `${res?.status()}`);

const shape = await page.evaluate(() => ({
  wordmark: !!document.querySelector('svg[aria-label="Kartly"]'),
  heading: document.querySelector("h1")?.textContent?.trim(),
  identifier: !!document.querySelector("#identifier"),
  password: document.querySelector("#password")?.getAttribute("type"),
  submit: [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Sign in"),
  createAccount: [...document.querySelectorAll("button")].some((b) => /Create your Kartly account/.test(b.textContent)),
  forgot: [...document.querySelectorAll("button")].some((b) => /Forgot your password/.test(b.textContent)),
  simulated: /Simulated sign-in/i.test(document.body.textContent),
  noNav: !document.querySelector('nav[aria-label="Departments and shortcuts"]'),
  continueWithout: !!document.querySelector('a[href="/"]'),
}));
check("wordmark shown", shape.wordmark);
check("heading is Sign in", shape.heading === "Sign in", shape.heading);
check("email/phone field present", shape.identifier);
check("password field is masked", shape.password === "password", `${shape.password}`);
check("sign-in button present", shape.submit);
check("create-account option present", shape.createAccount);
check("forgot-password option present", shape.forgot);
check("simulated messaging shown", shape.simulated);
check("uses stripped auth chrome", shape.noNav);
check("offers to continue without signing in", shape.continueWithout);
await page.screenshot({ path: path.join(OUT, "signin-desktop.png"), fullPage: false });

/* ---- invalid: empty ---- */
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForTimeout(350);
let body = (await page.locator("main").textContent()) || "";
check("empty form is rejected inline", /Enter your email or mobile phone number/.test(body) && /Enter your password/.test(body));
check("stays on /signin after invalid submit", page.url().includes("/signin"), page.url());

/* ---- invalid: bad email + short password ---- */
await page.fill("#identifier", "not-an-email@");
await page.fill("#password", "123");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForTimeout(350);
body = (await page.locator("main").textContent()) || "";
check("invalid email is rejected", /Enter a valid email address/.test(body));
check("short password is rejected", /at least 6 characters/i.test(body));
await page.screenshot({ path: path.join(OUT, "signin-validation.png"), fullPage: false });

/* ---- invalid: short phone ---- */
await page.fill("#identifier", "5551234");
await page.fill("#password", "demopass");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForTimeout(350);
check("short phone number is rejected", /10-digit phone number/.test((await page.locator("main").textContent()) || ""));

/* ---- forgot password reveals guidance, not a dead link ---- */
await page.getByRole("button", { name: /Forgot your password/ }).click();
await page.waitForTimeout(250);
check("forgot password explains the demo", /no password to reset/i.test((await page.locator("main").textContent()) || ""));

/* ---- create-account mode ---- */
await page.getByRole("button", { name: "Create your Kartly account" }).last().click();
await page.waitForTimeout(300);
const register = await page.evaluate(() => ({
  heading: document.querySelector("h1")?.textContent?.trim(),
  hasName: !!document.querySelector("#name"),
}));
check("create-account mode adds a name field", register.hasName && register.heading === "Create account", JSON.stringify(register));
await page.getByRole("button", { name: "Sign in instead" }).click();
await page.waitForTimeout(300);
check("can switch back to sign in", (await page.locator("h1").textContent())?.trim() === "Sign in");

/* ---- successful simulated sign-in ---- */
await page.fill("#identifier", "farhan.khan@example.com");
await page.fill("#password", "demopass");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL((u) => !u.pathname.includes("/signin"), { timeout: 20000 });
await settle(page);
check("successful sign-in leaves /signin", !page.url().includes("/signin"), page.url());
check("header greets the user by name", /Hello, Farhan/.test((await headerText(page)) || ""), ((await headerText(page)) || "").slice(0, 80));

const stored = await page.evaluate(() => {
  try {
    const raw = JSON.parse(localStorage.getItem("kartly.auth") || "{}");
    return raw?.state?.user ?? null;
  } catch { return null; }
});
check("demo user stored locally", !!stored && stored.name === "Farhan", JSON.stringify(stored));
check("no password is stored", JSON.stringify(stored || {}).toLowerCase().includes("demopass") === false, JSON.stringify(stored));

/* ---- refresh keeps the session ---- */
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
check("session survives a refresh", /Hello, Farhan/.test((await headerText(page)) || ""));

/* ---- account menu ---- */
await openAccountMenu(page);
const menu = await page.evaluate(() => {
  const m = document.querySelector('[role="menu"]');
  return m ? { items: [...m.querySelectorAll('[role="menuitem"], button')].map((b) => b.textContent.trim()) } : null;
});
check("account menu opens with orders, cart and sign out", !!menu && menu.items.some((i) => /Sign out/.test(i)) && menu.items.some((i) => /Your Orders/.test(i)), JSON.stringify(menu));
await page.screenshot({ path: path.join(OUT, "signin-account-menu.png"), fullPage: false });

/* ---- shopping still works while signed in ---- */
await page.keyboard.press("Escape");
await page.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded" });
await settle(page);
check("search works while signed in", (await page.locator("article").count()) > 0);

/* ---- sign out ---- */
const area = await openAccountMenu(page);
// Inside role="menu" the control is a menuitem, not a button, which is correct
// ARIA and is why a getByRole("button") lookup finds nothing here.
await area.getByRole("menuitem", { name: "Sign out" }).click();
await page.waitForTimeout(500);
check("sign out restores the signed-out greeting", /Hello, sign in/.test((await headerText(page)) || ""));
const cleared = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("kartly.auth") || "{}")?.state?.user ?? null; } catch { return "err"; }
});
check("sign out clears the stored user", cleared === null, JSON.stringify(cleared));

/* ---- header account link carries a return path ---- */
await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await settle(page);
const href = await page.locator('[data-testid="account-area"]').getAttribute("href");
check("account link preserves where you were", (href || "").includes("next=%2Forders"), `${href}`);
await page.locator('[data-testid="account-area"]').click();
await page.waitForURL(/\/signin/, { timeout: 20000 });
await settle(page);
await page.fill("#identifier", "sam@example.com");
await page.fill("#password", "demopass");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(/\/orders/, { timeout: 20000 });
check("sign-in returns to where you started", page.url().includes("/orders"), page.url());

/* ---- shopping works signed out (clean context) ---- */
await ctx.close();
const clean = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cpage = await clean.newPage();
attach(cpage, "signed-out");
await cpage.goto(`${BASE}/s?q=laptop`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(cpage);
check("signed out: search returns results", (await cpage.locator("article").count()) > 0);
await cpage.getByRole("button", { name: "Add to cart" }).first().click();
await cpage.waitForTimeout(700);
const cartLabel = (await cpage.locator('a[href="/cart"]').first().getAttribute("aria-label")) || "";
check("signed out: add to cart still works", /1 item/.test(cartLabel), cartLabel);
await cpage.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await settle(cpage);
check("signed out: checkout is reachable", /Delivery address/i.test((await cpage.locator("main").textContent()) || ""));
await clean.close();

/* ---- mobile ---- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
attach(mpage, "mobile");
await mpage.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
await settle(mpage);
const m = await mpage.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  formWidth: Math.round(document.querySelector("form").getBoundingClientRect().width),
}));
check("mobile: no horizontal overflow on /signin", !m.overflow, JSON.stringify(m));
check("mobile: form fits the viewport", m.formWidth <= 390, `${m.formWidth}px`);
await mpage.screenshot({ path: path.join(OUT, "signin-mobile.png"), fullPage: false });

await mpage.fill("#identifier", "mob@example.com");
await mpage.fill("#password", "demopass");
await mpage.getByRole("button", { name: "Sign in", exact: true }).click();
await mpage.waitForURL((u) => !u.pathname.includes("/signin"), { timeout: 20000 });
await settle(mpage);
check("mobile: sign-in updates the compact header", /Mob/.test((await headerText(mpage)) || ""), ((await headerText(mpage)) || "").slice(0, 60));
await mctx.close();

await browser.close();

const failed = checks.filter((c) => !c.passed);
console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`\nproblems (${problems.length}):`);
problems.forEach((p) => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
