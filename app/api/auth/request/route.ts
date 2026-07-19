import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { loginTokens } from "@/lib/schema";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const db = await getDb();
  await db.insert(loginTokens).values({
    token,
    email: email.toLowerCase(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const link = `${base}/api/auth/verify?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Voice Baby Album <login@voicebabyalbum.app>",
        to: email,
        subject: "Your sign-in link",
        html: `<p>Tap to sign in to Voice Baby Album:</p><p><a href="${link}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
      }),
    });
    return NextResponse.json({ sent: true });
  }
  // Dev mode: no email provider configured — hand the link back to the UI.
  return NextResponse.json({ sent: true, devLink: link });
}
