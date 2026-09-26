import { NextResponse } from "next/server";

/*
  The single exit for a failed API request.

  Every database error a client could see passes through here. That matters
  because Prisma's errors are chatty: a connection failure carries the host,
  port, user and database name, and a constraint violation carries column names
  and sometimes row values. None of that belongs in an HTTP response.

  So the real error is logged to the server and the client gets a fixed string.
  The status code is the only thing that varies with the cause.
*/

/** A message that is safe to show a client because we wrote it ourselves. */
export class ClientError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

export function apiError(error: unknown, context: string): NextResponse {
  if (error instanceof ClientError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Server-side only. Never returned.
  console.error(`[api] ${context}:`, error);

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
