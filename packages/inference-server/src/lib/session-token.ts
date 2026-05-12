/**
 * Phase G.3.b — HS256 session tokens for Pool A.
 *
 * Hand-rolled (no jsonwebtoken dependency) so the inference-server stays
 * lightweight. Token is { install_id, email, exp } signed with HMAC-SHA256
 * using WAVEX_INFERENCE_SESSION_SECRET. TTL is 30 minutes.
 *
 * Why not a real JWT library: a Pool A session token is one claim + one
 * verification per request. Adding jsonwebtoken pulls in extra deps + a
 * larger attack surface than the 30 LOC here.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const SECRET = process.env.WAVEX_INFERENCE_SESSION_SECRET ?? "";
const TTL_SEC = 30 * 60;

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + "=".repeat(pad), "base64");
}

function sign(payload: string): string {
  if (!SECRET) {
    throw new Error("WAVEX_INFERENCE_SESSION_SECRET not set — cannot sign Pool A tokens");
  }
  return base64UrlEncode(createHmac("sha256", SECRET).update(payload).digest());
}

export interface SessionPayload {
  install_id: string;
  email: string;
  exp: number; // unix seconds
}

export function issueSessionToken(install_id: string, email: string): string {
  const payload: SessionPayload = {
    install_id,
    email,
    exp: Math.floor(Date.now() / 1000) + TTL_SEC,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.install_id !== "string" || typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomInstallId(): string {
  return randomBytes(16).toString("hex");
}
