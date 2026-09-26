import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/api/errors";

/*
  Accounts and sessions.

  Deliberately small: sign up, sign in, sign out, and "who am I". No reset, no
  verification, no OAuth. Everything here is about getting those four right
  rather than covering more ground.

  The shape of it:

  * Passwords are bcrypt hashes. The plaintext is never stored, never logged and
    never returned - `safeUser()` is the only way a user leaves this module, and
    it has no passwordHash field to leak.

  * A session token is 32 random bytes. The database stores only its SHA-256;
    the raw token lives in one place, an httpOnly cookie. A leaked dump
    therefore cannot be replayed as a login, which is the whole reason not to
    store the token itself.

  * The auth cookie is separate from the guest `kartly_sid` in lib/session.ts.
    Signing in does not disturb a guest cart, and signing out does not empty it.
*/

const COOKIE = "kartly_auth";
const SESSION_DAYS = 30;
const MIN_PASSWORD = 6;
/* bcrypt rounds. 10 is the common default: slow enough to matter, fast enough
   that a sign-in is not a visible pause. */
const ROUNDS = 10;

export interface SafeUser {
  id: string;
  email: string;
  createdAt: string;
}

/** The only representation of a user that leaves this module. */
const safeUser = (u: { id: string; email: string; createdAt: Date }): SafeUser => ({
  id: u.id,
  email: u.email,
  createdAt: u.createdAt.toISOString(),
});

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

/** Deliberately permissive: shape only. Delivery is what proves an address. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(value: unknown): string {
  if (typeof value !== "string") throw new ClientError("Enter your email address");
  const email = value.trim().toLowerCase();
  if (email.length === 0) throw new ClientError("Enter your email address");
  if (email.length > 254 || !EMAIL.test(email)) throw new ClientError("Enter a valid email address");
  return email;
}

export function checkPassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new ClientError("Enter a password");
  if (value.length < MIN_PASSWORD) {
    throw new ClientError(`Password must be at least ${MIN_PASSWORD} characters`);
  }
  // bcrypt silently truncates beyond 72 bytes; refusing is honest.
  if (Buffer.byteLength(value, "utf8") > 72) throw new ClientError("Password is too long");
  return value;
}

/* ------------------------------------------------------------------ */
/* sessions                                                            */
/* ------------------------------------------------------------------ */

async function openSession(userId: string): Promise<void> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The signed-in user, or null.
 *
 * Safe in server components. An expired session is deleted on sight rather than
 * left to accumulate.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return safeUser(session.user);
}

/* ------------------------------------------------------------------ */
/* the four operations                                                 */
/* ------------------------------------------------------------------ */

export async function signUp(rawEmail: unknown, rawPassword: unknown): Promise<SafeUser> {
  const email = normaliseEmail(rawEmail);
  const password = checkPassword(rawPassword);

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ClientError("An account with that email already exists", 409);
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, ROUNDS) },
  });

  await openSession(user.id);
  return safeUser(user);
}

export async function signIn(rawEmail: unknown, rawPassword: unknown): Promise<SafeUser> {
  const email = normaliseEmail(rawEmail);
  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    throw new ClientError("Enter a password");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  /*
    One message for both "no such account" and "wrong password", and a hash
    comparison either way. Saying which one was wrong tells an attacker which
    emails are registered, and returning early on an unknown email makes that
    answerable from the response time alone.
  */
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(rawPassword, hash);

  if (!user || !ok) throw new ClientError("Email or password is incorrect", 401);

  await openSession(user.id);
  return safeUser(user);
}

/** A real bcrypt hash of a value nobody knows, to keep timing even. */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8e1S1cPZ0eXKpJ6ZC5Pq0rW8qk3Zqy";

export async function signOut(): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;

  if (raw) {
    // Delete by hash, so a token that is already gone is simply a no-op.
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(raw) } }).catch(() => {});
  }
  store.delete(COOKIE);
}

/** Exported for tests and tooling; never used to compare secrets by hand. */
export const AUTH_COOKIE = COOKIE;

/** Constant-time equality, for anywhere a raw token must be compared. */
export function tokensMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
