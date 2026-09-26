import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Deletes the session row and clears the cookie. Idempotent. */
export async function POST() {
  try {
    await signOut();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "POST /api/auth/logout");
  }
}
