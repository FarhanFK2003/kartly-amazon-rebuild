/**
 * Accounts: signup, login, logout, and the security properties around them.
 *
 * Every user and session this creates carries a qa- email domain and is deleted
 * in the finally block, so repeated runs leave nothing behind.
 *
 *   node scripts/qa/auth.mjs <output-dir>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE = process.env.KARTLY_BASE ?? "http://127.0.0.1:3000";
const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
let total = 0;
const check = (name, passed, detail = "") => {
  total++;
  if (!passed) problems.push(`FAILED: ${name}${detail ? ` - ${detail}` : ""}`);
};

for (const f of [".env.local", ".env"]) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Test accounts are identifiable, so cleanup can never touch a real one. */
const QA_DOMAIN = "qa-auth.invalid";
const EMAIL = `user-${randomUUID().slice(0, 8)}@${QA_DOMAIN}`;
const PASSWORD = "correct-horse";

/** An API client with its own cookie jar. */
function client() {
  let cookies = new Map();
  const call = async (pathname, init = {}) => {
    const cookie = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(cookie ? { cookie } : {}),
      },
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (value === "" || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) cookies.delete(name);
      else cookies.set(name, value);
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* reported by whichever check cares */
    }
    return { status: res.status, json, text, cookies };
  };
  call.jar = () => cookies;
  return call;
}

try {
  /* ---- 1-4. signup ----------------------------------------------------- */

  const api = client();

  const anon = await api("/api/auth/me");
  check("1. /api/auth/me is 401 when signed out", anon.status === 401, `${anon.status}`);

  const signup = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `  ${EMAIL.toUpperCase()}  `, password: PASSWORD }),
  });
  check("2. signup succeeds", signup.status === 201, `${signup.status} ${signup.text.slice(0, 80)}`);
  check(
    "3. the email is trimmed and lowercased",
    signup.json?.user?.email === EMAIL,
    `${signup.json?.user?.email}`
  );
  check(
    "4. signup response contains no password material",
    !/passwordHash|password/i.test(signup.text),
    signup.text.slice(0, 80)
  );

  const me = await api("/api/auth/me");
  check(
    "5. /api/auth/me returns the user once signed up",
    me.status === 200 && me.json?.user?.email === EMAIL,
    `${me.status}`
  );

  /* ---- 6-8. what is stored --------------------------------------------- */

  const row = await prisma.user.findUnique({ where: { email: EMAIL } });
  check("6. the user exists in PostgreSQL", Boolean(row), EMAIL);
  check(
    "7. the password is stored as a bcrypt hash, never plaintext",
    Boolean(row) && row.passwordHash !== PASSWORD && /^\$2[aby]\$\d{2}\$/.test(row.passwordHash),
    row ? `${row.passwordHash.slice(0, 7)}...` : "no row"
  );

  const sessions = await prisma.authSession.findMany({ where: { userId: row?.id ?? "" } });
  const rawToken = api.jar().get("kartly_auth");
  check(
    "8. only the token hash is stored, never the raw token",
    sessions.length === 1 && Boolean(rawToken) && sessions[0].tokenHash !== rawToken,
    `${sessions.length} session(s)`
  );

  /* ---- 9-11. rejections ------------------------------------------------ */

  const dup = await client()("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check("9. a duplicate email is rejected", dup.status === 409, `${dup.status}`);

  const short = await client()("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `short-${randomUUID().slice(0, 6)}@${QA_DOMAIN}`, password: "abc" }),
  });
  check("10. a password under six characters is rejected", short.status === 400, `${short.status}`);

  const badEmail = await client()("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: "not-an-email", password: PASSWORD }),
  });
  check("11. an invalid email is rejected", badEmail.status === 400, `${badEmail.status}`);

  /* ---- 12-14. login ---------------------------------------------------- */

  const wrong = await client()("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: "not-the-password" }),
  });
  check("12. a wrong password is rejected", wrong.status === 401, `${wrong.status}`);

  const unknown = await client()("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `nobody-${randomUUID().slice(0, 6)}@${QA_DOMAIN}`, password: PASSWORD }),
  });
  check(
    "13. an unknown email gives the same answer as a wrong password",
    unknown.status === 401 && unknown.text === wrong.text,
    `${unknown.status} / ${unknown.text.slice(0, 50)}`
  );

  const fresh = client();
  const login = await fresh("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check(
    "14. correct credentials sign in",
    login.status === 200 && login.json?.user?.email === EMAIL,
    `${login.status}`
  );

  /* ---- 15-16. logout --------------------------------------------------- */

  const before = await prisma.authSession.count({ where: { userId: row.id } });
  const out = await fresh("/api/auth/logout", { method: "POST" });
  check("15. logout succeeds", out.status === 200, `${out.status}`);

  const after = await prisma.authSession.count({ where: { userId: row.id } });
  const loggedOut = await fresh("/api/auth/me");
  check(
    "16. logout invalidates the session server-side",
    after === before - 1 && loggedOut.status === 401,
    `${before} -> ${after} sessions, /me ${loggedOut.status}`
  );

  /* ---- 17-20. the browser --------------------------------------------- */

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  const signinText = await page.locator("body").innerText();
  check(
    "17. the simulated-sign-in notice is gone",
    !/simulated sign-in|nothing is authenticated/i.test(signinText),
    signinText.slice(0, 80).replace(/\s+/g, " ")
  );
  check(
    "18. the non-functional password reset is gone",
    !/forgot your password/i.test(signinText)
  );

  await page.getByLabel(/Email address/i).fill(EMAIL);
  await page.getByLabel(/^Password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.toString().includes("/signin"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const authCookie = (await ctx.cookies()).find((c) => c.name === "kartly_auth");
  check(
    "19. the auth cookie is httpOnly and sameSite lax",
    Boolean(authCookie?.httpOnly) && /lax/i.test(authCookie?.sameSite ?? ""),
    `httpOnly=${authCookie?.httpOnly} sameSite=${authCookie?.sameSite}`
  );

  const readable = await page.evaluate(() => document.cookie.includes("kartly_auth"));
  check("20. page script cannot read the auth cookie", !readable);

  const stored = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).filter((k) => /auth/i.test(k)))
  );
  check("21. no authentication state is kept in localStorage", stored === "[]", stored);

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  const accountText = await page.locator("body").innerText();
  check("22. the account page shows the signed-in email", accountText.includes(EMAIL), accountText.slice(0, 80));

  /* ---- 23-25. guest shopping still works ------------------------------- */

  const guest = await page.evaluate(async () => {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", productId: "electronics-03", qty: 1 }),
    });
    return { status: res.status, body: await res.json() };
  });
  check(
    "23. an authenticated shopper can still use the cart",
    guest.status === 200 && guest.body.lines.length === 1,
    `${guest.status}`
  );

  await page.getByRole("button", { name: /^Sign out$/ }).click().catch(() => {});
  await page.waitForTimeout(1500);
  const afterSignOut = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
  check("24. signing out from the account page ends the session", afterSignOut === 401, `${afterSignOut}`);

  const cartAfter = await page.evaluate(async () => (await (await fetch("/api/cart")).json()).lines.length);
  check("25. signing out does not empty the guest cart", cartAfter === 1, `${cartAfter} line(s)`);

  /* ---- 26. the yellow primary is actually rendered --------------------- */

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const swatch = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const cta = [...document.querySelectorAll("a,button")].find((el) =>
      /start browsing|add to cart/i.test(el.textContent || "")
    );
    return {
      brand: root.getPropertyValue("--color-brand").trim(),
      onBrand: root.getPropertyValue("--color-on-brand").trim(),
      ctaBg: cta ? getComputedStyle(cta).backgroundColor : null,
      ctaColor: cta ? getComputedStyle(cta).color : null,
    };
  });
  check(
    "26. the primary token is the new yellow and CTAs render it",
    swatch.brand.toLowerCase() === "#f4b942" && swatch.ctaBg === "rgb(244, 185, 66)",
    JSON.stringify(swatch)
  );
  check(
    "27. primary CTAs use near-black text on the yellow",
    swatch.ctaColor === "rgb(23, 23, 23)",
    `${swatch.ctaColor}`
  );

  await browser.close();
} finally {
  /* Deletes only qa-auth.invalid accounts; sessions cascade with the user. */
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${QA_DOMAIN}` } } }).catch(() => {});
  await prisma.cart.deleteMany({ where: { sessionId: { startsWith: "qa-" } } }).catch(() => {});
  await prisma.$disconnect();
}

console.log(`\n${total - problems.length}/${total} auth checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
