import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The Prisma client.
 *
 * Prisma 7 no longer reads the connection URL from schema.prisma; the client is
 * handed a driver adapter instead, which is what `PrismaPg` is - a thin binding
 * over a `pg` connection pool. That is why the connection string is read here
 * rather than declared in the schema.
 *
 * Two things this file has to get right:
 *
 * Hot reload. Next re-evaluates modules on every edit in development, so a
 * plain `new PrismaClient()` at module scope would open a fresh pool per save
 * and exhaust Postgres within a few minutes. The instance is parked on
 * globalThis and reused. In production the module is evaluated once and the
 * global is never touched.
 *
 * Build time. Route modules are imported during `next build`, on a machine that
 * may have no database and no DATABASE_URL. So construction is deferred behind
 * a proxy: importing this module is free, and the client - along with the
 * complaint about a missing URL - is created on the first actual query.
 *
 * This is the whole database layer. Prisma already is the abstraction; wrapping
 * it in a repository of our own would add indirection without adding anything.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in - see docs/backend.md."
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = created;
  return created;
}

// In production the proxy resolves to a client built on first use and then
// closed over by `resolved`, so there is still exactly one instance.
let resolved: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    resolved ??= getClient();
    const value = Reflect.get(resolved, property, resolved);
    // Methods must keep their real receiver; `prisma.$transaction` called
    // through the proxy would otherwise lose `this`.
    return typeof value === "function" ? value.bind(resolved) : value;
  },
});
