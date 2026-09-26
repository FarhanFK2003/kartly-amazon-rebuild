import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/errors";
import {
  buildOrderBy,
  buildWhere,
  parseQuery,
  productInclude,
  toProductDto,
} from "@/lib/api/products";

/*
  GET /api/products - the product collection, read from PostgreSQL.

  Nothing here reads data/catalog.json or lib/catalog.ts. The catalogue file is
  now only a seed source; this route's only source of truth is the database.

  Supported query parameters:
    q         substring match on title, brand or category name
    category  category id, e.g. "electronics"
    brand     brand name, case-insensitive
    sort      featured | price-asc | price-desc | rating | newest
    page      1-based, default 1
    limit     1-100, default 16
*/

// These routes must never be prerendered: the build machine has no database.
// Reading request.url already forces this, but saying so keeps it true even if
// the handler later stops touching the request.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = parseQuery(new URL(request.url));
    const where = buildWhere(query);

    // One round trip, and a consistent snapshot: with a separate count, a
    // concurrent write could report a total that disagrees with the page.
    const [total, rows] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: buildOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return NextResponse.json(
      {
        products: rows.map(toProductDto),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
        source: "postgres",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error, "GET /api/products");
  }
}
