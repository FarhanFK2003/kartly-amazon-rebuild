import { NextResponse } from "next/server";
import { suggest } from "@/lib/suggest";

/**
 * Local suggestion endpoint. Nothing external is called - this reads the same
 * PostgreSQL database the rest of the storefront now uses.
 *
 * It exists as a route rather than a client-side index because the header
 * renders on every page, and shipping a 120-product suggestion index into every
 * bundle to serve a dropdown that most visits never open is a poor trade.
 */
// Suggestions are read from a live database, so this is not prerendered.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0) return NextResponse.json({ suggestions: [] });

  return NextResponse.json(
    { suggestions: await suggest(q) },
    /*
      Previously cached hard, which was right for a catalogue compiled into the
      bundle. It is wrong now: a title corrected in the database would keep
      being suggested under its old text for up to an hour, and tapping that
      suggestion would run a search that matches nothing. The dropdown and the
      results page have to agree about what exists.
    */
    { headers: { "Cache-Control": "no-store" } }
  );
}
