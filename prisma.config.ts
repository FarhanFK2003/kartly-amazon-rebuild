import path from "node:path";
import { existsSync } from "node:fs";
import { defineConfig, env } from "@prisma/config";

/*
  Prisma CLI configuration.

  Prisma 7 moved the connection URL out of schema.prisma and stopped loading
  .env files on its own (it passes `dotenv: false` to its config loader), so
  both jobs land here. Next.js still loads .env for the application itself;
  this only covers CLI commands - migrate, db, studio, seed.

  Nothing in this file holds a credential. It reads one from the environment
  and fails loudly if it is absent, which is the behaviour you want: a silent
  fallback to some default connection string is how a migration ends up run
  against the wrong database.
*/

// Node 22 can read a .env file directly. Optional, because CI and deployment
// targets supply DATABASE_URL through the environment rather than a file.
for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (existsSync(full)) process.loadEnvFile(full);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    // tsx runs the TypeScript seed without a build step.
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Used only by the CLI. Migrations need a direct connection, so if the
    // deployment uses a connection pooler this should be the unpooled URL.
    // env() throws when a variable is missing, so DIRECT_URL is probed through
    // process.env first to keep it genuinely optional.
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
