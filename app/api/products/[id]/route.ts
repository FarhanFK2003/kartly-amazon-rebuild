import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/errors";
import { productInclude, toProductDto } from "@/lib/api/products";

/*
  GET /api/products/[id] - one product, read from PostgreSQL.

  Resolves by catalogue id or slug, because /dp/[id] accepts either and an API
  that accepted only one of them would be a second, subtly different contract.
*/

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/products/[id]">
) {
  try {
    const { id } = await ctx.params;

    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: productInclude,
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(
      { product: toProductDto(product), source: "postgres" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error, "GET /api/products/[id]");
  }
}
