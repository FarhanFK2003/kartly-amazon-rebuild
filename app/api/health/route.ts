import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/errors";

/*
  GET /api/health - proves the process can actually reach PostgreSQL.

  A products endpoint that returns rows could in principle be returning anything;
  this one answers a narrower question. It runs a trivial statement against the
  server and reports the row counts it finds, so "the database is connected and
  seeded" becomes something you can check rather than assume.

  Note what it does not return: no connection string, no host, no user, no
  driver detail. A failure is reported as a failure and the reason goes to the
  server log only - see lib/api/errors.ts.
*/

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const started = Date.now();

    // A statement the planner cannot satisfy from cache or metadata.
    await prisma.$queryRaw`SELECT 1`;

    const [categories, brands, products, variants, reviews] = await Promise.all([
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.review.count(),
    ]);

    return NextResponse.json(
      {
        status: "ok",
        database: "postgresql",
        latencyMs: Date.now() - started,
        counts: { categories, brands, products, variants, reviews },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error, "GET /api/health");
  }
}
