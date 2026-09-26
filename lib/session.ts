import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/*
  Guest session identity.

  Authentication is not part of this stage, so a cart and its orders need an
  owner that is not an account. That owner is an opaque cookie.

  What the value is: 32 bytes from the system CSPRNG, base64url encoded. It
  carries no meaning at all - not an email, not a product id, not a user id,
  nothing derived from the database. It cannot be guessed at 256 bits, and
  because it means nothing, learning one tells an attacker nothing beyond the
  cart it points at.

  How it is protected:

    httpOnly  - script on the page cannot read it, so an XSS bug cannot lift a
                shopper's cart identity
    sameSite  - "lax", so another origin cannot drive cart or order requests
                with the shopper's cookie attached
    secure    - in production only, because localhost is served over http
    path "/"  - the storefront and the API share one identity

  The browser never receives anything else. There is no database credential, no
  connection string and no direct database access on the client; every read and
  write goes through a route handler that resolves this cookie server-side.
*/

const COOKIE = "kartly_sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const SESSION_COOKIE = COOKIE;

/**
 * The current session id, or null.
 *
 * Safe in server components, which may read cookies but may not set them. A
 * visitor with no cookie has no cart, which is the correct answer rather than
 * a reason to mint an identity for someone who has not interacted yet.
 */
export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/**
 * The current session id, creating and setting one if absent.
 *
 * Only valid inside a route handler or server action, where the response can
 * still carry a Set-Cookie header.
 */
export async function requireSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const id = randomBytes(32).toString("base64url");
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}
