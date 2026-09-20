import { NextResponse } from "next/server";
import { suggest } from "@/lib/suggest";

/**
 * Local suggestion endpoint. Nothing external is called - this reads the same
 * static catalogue the rest of the app uses.
 *
 * It exists as a route rather than a client-side index because the header
 * renders on every page, and shipping a 120-product suggestion index into every
 * bundle to serve a dropdown that most visits never open is a poor trade.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0) return NextResponse.json({ suggestions: [] });

  return NextResponse.json(
    { suggestions: suggest(q) },
    // Same catalogue for everyone, so suggestions are safe to cache hard.
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  );
}
