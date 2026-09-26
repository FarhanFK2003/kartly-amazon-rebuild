/**
 * Cart and order persistence, against PostgreSQL.
 *
 * Wave 6C moved the cart and orders out of localStorage and onto the server.
 * This suite checks three things the other suites cannot:
 *
 *   * the cart survives a refresh because it is in the database, not because
 *     the browser remembered it;
 *   * the server prices the cart itself - a client that supplies its own
 *     price, subtotal or total changes nothing;
 *   * one session cannot read another session's cart or orders.
 *
 * It creates one real order, verifies it row by row in PostgreSQL, and deletes
 * it again. Nothing it writes is left behind.
 *
 *   node scripts/qa/persistence.mjs <output-dir>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TID, byTestId } from "./selectors.mjs";

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

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/* Everything this run creates, so the finally block can remove all of it. */
const createdOrderIds = [];
const createdSessionIds = [];

/**
 * A standalone API client with its own cookie jar - i.e. its own session.
 *
 * The session id is recorded as soon as the server issues one, so the cart it
 * creates can be deleted again when the suite finishes. This suite leaves
 * nothing behind.
 */
function session() {
  let cookie = "";
  const client = async (pathname, init = {}) => {
    const res = await fetch(`${BASE}${pathname}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      if (!c.startsWith("kartly_sid=")) continue;
      cookie = c.split(";")[0];
      const value = cookie.slice("kartly_sid=".length);
      if (!createdSessionIds.includes(value)) createdSessionIds.push(value);
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON is a failure the caller will report */
    }
    return { status: res.status, json, text };
  };
  return client;
}



try {
  /* ---- fixtures ------------------------------------------------------- */

  const productA = await prisma.product.findFirst({
    where: { stock: { gt: 0 }, variants: { some: {} } },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  const productB = await prisma.product.findFirst({
    where: { stock: { gt: 0 }, id: { not: productA.id } },
  });

  /* ---- 1-7. the cart survives, because it is in the database ---------- */

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));

  const go = (url) => page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });

  /*
    Click, and require the cart request it should cause.

    These pages are server-rendered per request, so the document arrives before
    React attaches its handlers and a click in that window silently does
    nothing. React 19 hydrates subtrees independently, so no single "page is
    ready" signal covers the buy box - waiting on CartSync's own request is not
    enough. So the click is retried until the request it is supposed to trigger
    actually appears. A genuinely broken button still fails, because every
    attempt within the window produces nothing.
  */
  const clickForCart = async (locator, attempts = 12) => {
    for (let i = 0; i < attempts; i++) {
      const posted = page
        .waitForResponse(
          (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
          { timeout: 1000 }
        )
        .catch(() => null);
      await locator.click({ timeout: 5000 }).catch(() => {});
      if (await posted) return true;
    }
    return false;
  };

  const cartQty = async () => {
    const res = await page.evaluate(async () => (await fetch("/api/cart")).json());
    return res.lines.reduce((n, l) => n + l.qty, 0);
  };

  await go(`/dp/${productA.slug}`);
  await clickForCart(byTestId(page, TID.pdpAddToCart).first());
  await page.waitForTimeout(400);
  check("1. a product can be added to the cart", (await cartQty()) >= 1, `${await cartQty()}`);

  /* The buy box adds the default variant, so later calls have to address the
     same line - a product id alone identifies a different line. */
  const firstLine = (await page.evaluate(async () => (await fetch("/api/cart")).json())).lines[0];

  await go("/cart");
  const afterRefresh = await cartQty();
  check("2. the cart survives a refresh", afterRefresh >= 1, `${afterRefresh}`);

  /* The cookie is the only thing carrying identity, and script cannot read it. */
  const cookieVisibleToScript = await page.evaluate(() => document.cookie.includes("kartly_sid"));
  check("3. the session cookie is not readable by page script", !cookieVisibleToScript);

  const sid = (await ctx.cookies()).find((c) => c.name === "kartly_sid");
  if (sid) createdSessionIds.push(sid.value);
  check(
    "4. the session cookie is httpOnly and sameSite",
    Boolean(sid?.httpOnly) && /lax/i.test(sid?.sameSite ?? ""),
    `httpOnly=${sid?.httpOnly} sameSite=${sid?.sameSite}`
  );

  await page.evaluate(
    async (line) => {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setQty",
          productId: line.productId,
          variantId: line.variantId,
          qty: 3,
        }),
      });
    },
    firstLine
  );
  await go("/cart");
  check("5. a quantity change survives a refresh", (await cartQty()) === 3, `${await cartQty()}`);

  await page.evaluate(
    async (line) => {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          productId: line.productId,
          variantId: line.variantId,
        }),
      });
    },
    firstLine
  );
  await go("/cart");
  check("6. a removal survives a refresh", (await cartQty()) === 0, `${await cartQty()}`);

  /* two variants of the same product are two lines, not one */
  const [v1, v2] = productA.variants;
  await page.evaluate(
    async ({ id, a, b }) => {
      for (const variantId of [a, b]) {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", productId: id, variantId, qty: 1 }),
        });
      }
    },
    { id: productA.id, a: v1?.id ?? null, b: v2?.id ?? v1?.id ?? null }
  );
  const lines = await page.evaluate(async () => (await fetch("/api/cart")).json());
  check(
    "7. distinct variants are distinct cart lines",
    v2 ? lines.lines.length === 2 : lines.lines.length === 1,
    `${lines.lines.length} lines for ${productA.variants.length} variants`
  );

  await browser.close();
  check("8. no page errors during cart interaction", errors.length === 0, errors.slice(0, 2).join(" | "));

  /* ---- 9-14. server authority over money ------------------------------ */

  const api = session();
  await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({ action: "add", productId: productB.id, qty: 2 }),
  });

  const expectedSubtotal = productB.price * 2;
  const honest = await api("/api/cart");
  check(
    "9. the server prices the cart from the database",
    honest.json.totals.subtotal === expectedSubtotal,
    `server ${honest.json.totals.subtotal} vs db ${expectedSubtotal}`
  );

  /* A client supplying its own money fields must change nothing. */
  const liar = await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({
      action: "setQty",
      productId: productB.id,
      qty: 2,
      price: 1,
      unitPrice: 1,
      subtotal: 1,
      shipping: 0,
      tax: 0,
      total: 1,
    }),
  });
  check(
    "10. client-supplied price, subtotal, tax and total are ignored",
    liar.json.totals.subtotal === expectedSubtotal && liar.json.totals.total !== 1,
    `subtotal ${liar.json.totals.subtotal}, total ${liar.json.totals.total}`
  );

  const badProduct = await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({ action: "add", productId: "no-such-product", qty: 1 }),
  });
  check("11. an unknown product id is rejected", badProduct.status === 404, `${badProduct.status}`);

  const badVariant = await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({ action: "add", productId: productB.id, variantId: v1?.id ?? "nope", qty: 1 }),
  });
  check(
    "12. a variant belonging to another product is rejected",
    badVariant.status === 400,
    `${badVariant.status}`
  );

  for (const [label, qty, expected] of [
    ["zero", 0, 400],
    ["negative", -5, 400],
    ["over the line limit", 999, 400],
    ["fractional", 1.5, 400],
  ]) {
    const res = await api("/api/cart", {
      method: "POST",
      body: JSON.stringify({ action: "add", productId: productB.id, qty }),
    });
    check(`13. a ${label} quantity is rejected`, res.status === expected, `${res.status}`);
  }

  /* ---- 14-15. session isolation --------------------------------------- */

  const stranger = session();
  const strangerCart = await stranger("/api/cart");
  check(
    "14. a new session sees an empty cart, not someone else's",
    strangerCart.json.lines.length === 0,
    `${strangerCart.json.lines.length} lines`
  );

  /* ---- 16-21. placing an order ---------------------------------------- */

  const key = `qa-${Date.now()}`;
  const placed = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      address: {
        fullName: "Ada Lovelace",
        line1: "12 Analytical Way",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        phone: "5550192837",
      },
      payment: { method: "card", brand: "Visa", last4: "1111" },
      idempotencyKey: key,
      // Deliberate lies the server must ignore.
      subtotal: 1,
      total: 1,
      items: [{ productId: productB.id, qty: 99, unitPrice: 1 }],
    }),
  });
  check("16. an order is created", placed.status === 201, `${placed.status} ${placed.text.slice(0, 80)}`);

  const orderId = placed.json?.order?.id;
  if (orderId) createdOrderIds.push(orderId);

  const row = orderId
    ? await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
    : null;
  check("17. the order exists in PostgreSQL", Boolean(row), orderId ?? "no id");
  check("18. order items exist in PostgreSQL", (row?.items.length ?? 0) > 0, `${row?.items.length}`);

  check(
    "19. the stored unit price is the server-resolved database price",
    row?.items[0]?.unitPrice === productB.price,
    `stored ${row?.items[0]?.unitPrice} vs db ${productB.price}`
  );

  /* Totals must match lib/commerce.ts, not the numbers the client sent. */
  const sub = expectedSubtotal;
  const shipping = sub >= 3500 ? 0 : 599;
  const tax = Math.round(sub * 0.0825);
  check(
    "20. stored totals match the commerce calculation, not the client's",
    row?.subtotal === sub && row?.shipping === shipping && row?.tax === tax && row?.total === sub + shipping + tax,
    `${row?.subtotal}/${row?.shipping}/${row?.tax}/${row?.total} expected ${sub}/${shipping}/${tax}/${sub + shipping + tax}`
  );
  check(
    "21. the client's forged quantity was ignored",
    row?.items.every((i) => i.qty !== 99),
    row?.items.map((i) => i.qty).join(",")
  );

  check(
    "22. no card number, expiry or CVV is stored",
    row?.paymentLast4 === "1111" && !("cardNumber" in (row ?? {})) && !("cvv" in (row ?? {})),
    Object.keys(row ?? {}).join(",")
  );

  /* ---- 23. the cart is cleared ---------------------------------------- */

  const afterOrder = await api("/api/cart");
  check(
    "23. the cart is emptied once the order is placed",
    afterOrder.json.lines.length === 0,
    `${afterOrder.json.lines.length} lines`
  );

  /* ---- 24. idempotency ------------------------------------------------ */

  const repeat = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      address: {
        fullName: "Ada Lovelace",
        line1: "12 Analytical Way",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        phone: "5550192837",
      },
      payment: { method: "card", brand: "Visa", last4: "1111" },
      idempotencyKey: key,
    }),
  });
  const orderCount = await prisma.order.count({ where: { idempotencyKey: key } });
  check(
    "24. resubmitting the same checkout returns the original order",
    repeat.json?.order?.id === orderId && orderCount === 1,
    `${repeat.json?.order?.id} vs ${orderId}, ${orderCount} rows`
  );

  /* ---- 25-27. order access control ------------------------------------ */

  const mine = await api(`/api/orders/${orderId}`);
  check("25. the placing session can read its order", mine.status === 200, `${mine.status}`);

  const theirs = await stranger(`/api/orders/${orderId}`);
  check(
    "26. another session cannot read that order by id",
    theirs.status === 404,
    `${theirs.status} ${theirs.text.slice(0, 60)}`
  );

  const strangerList = await stranger("/api/orders");
  check(
    "27. another session's order list does not include it",
    !(strangerList.json?.orders ?? []).some((o) => o.id === orderId),
    `${strangerList.json?.orders?.length} orders`
  );

  /* ---- 28. the confirmation page survives a reload --------------------- */

  const b2 = await chromium.launch();
  const c2 = await b2.newContext();
  const sidValue = createdSessionIds[0];
  const orderSession = await prisma.order.findUnique({
    where: { id: orderId },
    select: { sessionId: true },
  });
  await c2.addCookies([
    {
      name: "kartly_sid",
      value: orderSession.sessionId,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const p2 = await c2.newPage();
  await p2.goto(`${BASE}/order-confirmation/${orderId}`, { waitUntil: "networkidle" });
  const confirmText = await p2.locator("body").innerText();
  check(
    "28. the confirmation page renders the order after a fresh load",
    confirmText.includes(orderId),
    confirmText.slice(0, 80).replace(/\s+/g, " ")
  );

  await p2.goto(`${BASE}/orders`, { waitUntil: "networkidle" });
  check(
    "29. order history renders the order",
    (await p2.locator("body").innerText()).includes(orderId)
  );

  /* an unrelated browser must not see it */
  const c3 = await b2.newContext();
  const p3 = await c3.newPage();
  await p3.goto(`${BASE}/order-confirmation/${orderId}`, { waitUntil: "networkidle" });
  check(
    "30. a browser without the session cannot see the order",
    !(await p3.locator("body").innerText()).includes("Ada Lovelace"),
    "order details leaked to an unrelated session"
  );
  await b2.close();
  if (sidValue) {
    /* keep the reference used above meaningful for cleanup */
  }

  /* ---- 31-33. the price-authority proof -------------------------------- */

  const proofSession = session();
  await proofSession("/api/cart", {
    method: "POST",
    body: JSON.stringify({ action: "add", productId: productB.id, qty: 1 }),
  });

  const originalPrice = productB.price;
  const bumped = originalPrice + 5000;
  try {
    await prisma.product.update({ where: { id: productB.id }, data: { price: bumped } });

    const repriced = await proofSession("/api/cart");
    check(
      "31. the cart reprices from PostgreSQL when the product price changes",
      repriced.json.totals.subtotal === bumped,
      `${repriced.json.totals.subtotal} expected ${bumped}`
    );
  } finally {
    await prisma.product.update({ where: { id: productB.id }, data: { price: originalPrice } });
  }

  const restored = await proofSession("/api/cart");
  check(
    "32. restoring the price restores the cart total",
    restored.json.totals.subtotal === originalPrice,
    `${restored.json.totals.subtotal}`
  );

  /* ---- 33. errors expose nothing -------------------------------------- */

  const leaky = /postgresql:\/\/|password|neon\.tech|prisma|PrismaClient|node_modules|5432/i;
  const bodies = [badProduct.text, badVariant.text, theirs.text];
  check(
    "33. error responses expose no connection or driver detail",
    !bodies.some((b) => leaky.test(b)),
    bodies.find((b) => leaky.test(b))?.slice(0, 100)
  );
} finally {
  /* ---- cleanup: nothing this suite created is left behind -------------- */
  for (const id of createdOrderIds) {
    await prisma.order.delete({ where: { id } }).catch(() => {});
  }
  if (createdSessionIds.length > 0) {
    // Cart items cascade with the cart row.
    await prisma.cart
      .deleteMany({ where: { sessionId: { in: createdSessionIds } } })
      .catch(() => {});
  }
  await prisma.$disconnect();
}

console.log(`\n${total - problems.length}/${total} persistence checks passed`);
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
