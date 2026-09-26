import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The signed-in user, or 401. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "GET /api/auth/me");
  }
}
