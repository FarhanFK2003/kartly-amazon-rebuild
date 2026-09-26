import { NextResponse } from "next/server";
import { apiError, ClientError } from "@/lib/api/errors";
import { signUp } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Creates an account and signs it in. Returns the user, never the hash. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ClientError("Expected a JSON body");
    });
    const { email, password } = (body ?? {}) as Record<string, unknown>;
    const user = await signUp(email, password);
    return NextResponse.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "POST /api/auth/signup");
  }
}
