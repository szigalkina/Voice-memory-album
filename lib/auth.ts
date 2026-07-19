import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-not-for-production"
);
const COOKIE = "vba_session";

export async function createSession(userId: string) {
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(SECRET);
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
}

export async function getUserId(): Promise<string | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, SECRET);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
