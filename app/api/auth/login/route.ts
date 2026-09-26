import { NextResponse } from "next/server";
import { apiError, ClientError } from "@/lib/api/errors";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Signs in. A wrong password and an unknown email give the same 401, so this
 * endpoint cannot be used to find out which addresses are registered.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ClientError("Expected a JSON body");
    });
    const { email, password } = (body ?? {}) as Record<string, unknown>;
    const user = await signIn(email, password);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "POST /api/auth/login");
  }
}
