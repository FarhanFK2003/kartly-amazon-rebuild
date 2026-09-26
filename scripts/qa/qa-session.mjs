/**
 * Identifiable, self-cleaning QA sessions.
 *
 * Any suite that drives the storefront creates a cart, and the purchase suite
 * creates a real order. Left alone those records accumulate in the database on
 * every run.
 *
 * So a suite claims its own session identity instead of letting the server mint
 * one: it sets the `kartly_sid` cookie itself to a value beginning "qa-", which
 * nothing else uses. Every cart and order it causes is then owned by a session
 * it can find again.
 *
 * Cleanup runs twice - before the suite, which clears anything an earlier run
 * left behind when it crashed, and after it. Between the two, repeated runs
 * cannot accumulate records whatever happens in between.
 *
 * Only rows whose session id carries the prefix are ever deleted, so no real
 * order is reachable from here.
 */

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const QA_SESSION_PREFIX = "qa-";

for (const envFile of [".env.local", ".env"]) {
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** A fresh session id for this run, tagged with the suite's name. */
export const qaSessionId = (suite) => `${QA_SESSION_PREFIX}${suite}-${randomUUID()}`;

/** Removes every cart and order owned by a QA session. Items cascade. */
export async function purgeQaRecords() {
  const where = { sessionId: { startsWith: QA_SESSION_PREFIX } };
  const orders = await prisma.order.deleteMany({ where }).catch(() => ({ count: 0 }));
  const carts = await prisma.cart.deleteMany({ where }).catch(() => ({ count: 0 }));
  return { orders: orders.count, carts: carts.count };
}

/**
 * Wires a suite up: purges leftovers now, and guarantees a purge on the way out
 * - on a normal finish, on a failing run, and on an unhandled throw.
 *
 * Returns the cookie to install on every browser context the suite creates.
 */
export async function startQaSession(suite, baseUrl) {
  const left = await purgeQaRecords();
  if (left.orders || left.carts) {
    console.log(`  cleared ${left.orders} order(s) and ${left.carts} cart(s) from a previous run`);
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await purgeQaRecords();
    await prisma.$disconnect().catch(() => {});
  };

  process.on("beforeExit", () => void cleanup());
  process.on("uncaughtException", async (error) => {
    await cleanup();
    console.error(error);
    process.exit(1);
  });

  const id = qaSessionId(suite);
  return {
    sessionId: id,
    cleanup,
    cookie: { name: "kartly_sid", value: id, url: baseUrl, httpOnly: true, sameSite: "Lax" },
  };
}

/** Counts of anything a QA session still owns. Used to assert cleanliness. */
export async function qaRecordCounts() {
  const where = { sessionId: { startsWith: QA_SESSION_PREFIX } };
  const [orders, carts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.cart.count({ where }),
  ]);
  return { orders, carts };
}
