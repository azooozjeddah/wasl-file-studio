import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq, and, gt, isNull } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { passwordResetTokens, users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { getSessionCookieOptions } from "../_core/cookies";
import type { Request, Response } from "express";

const scrypt = promisify(scryptCallback);
export const WASL_SESSION_COOKIE = "wasl_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_RESET_LIFETIME_MS = 1000 * 60 * 30;

export type WaslPublicUser = Pick<User, "id" | "name" | "email" | "role" | "createdAt" | "lastSignedIn">;

function sessionSecret() { return new TextEncoder().encode(ENV.cookieSecret); }
function normaliseEmail(email: string) { return email.trim().toLowerCase(); }

export function validateWaslPassword(password: string) {
  return password.length >= 10 && password.length <= 128;
}

export async function hashWaslPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyWaslPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function toWaslPublicUser(user: User): WaslPublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, lastSignedIn: user.lastSignedIn };
}

export async function hasWaslAdmin() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const result = await db.select({ id: users.id }).from(users).where(and(eq(users.waslAccount, true), eq(users.role, "admin"))).limit(1);
  return Boolean(result[0]);
}

export async function createWaslAccount(input: { name: string; email: string; password: string; role?: "user" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const email = normaliseEmail(input.email);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw new Error("يوجد حساب مسجل بهذا البريد الإلكتروني.");
  const passwordHash = await hashWaslPassword(input.password);
  const now = new Date();
  const result = await db.insert(users).values({ openId: `wasl_${nanoid(20)}`, name: input.name.trim(), email, loginMethod: "wasl_password", passwordHash, waslAccount: true, accountStatus: "active", role: input.role ?? "user", lastSignedIn: now });
  const id = Number(result[0].insertId);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new Error("تعذر إنشاء حساب وصل.");
  return user;
}

export async function getWaslUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [user] = await db.select().from(users).where(eq(users.email, normaliseEmail(email))).limit(1);
  return user;
}

export async function createWaslSession(user: User) {
  const expiry = Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000);
  return new SignJWT({ type: "wasl", role: user.role, email: user.email ?? "" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(String(user.id)).setExpirationTime(expiry).sign(sessionSecret());
}

export function writeWaslSession(req: Request, res: Response, token: string) {
  const base = getSessionCookieOptions(req);
  res.cookie(WASL_SESSION_COOKIE, token, { ...base, sameSite: "lax", maxAge: SESSION_MAX_AGE_MS });
}

export function clearWaslSession(req: Request, res: Response) {
  const base = getSessionCookieOptions(req);
  res.clearCookie(WASL_SESSION_COOKIE, { ...base, sameSite: "lax", maxAge: -1 });
}

export async function getWaslSessionUser(req: Request): Promise<User | null> {
  const token = parseCookie(req.headers.cookie || "")[WASL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (payload.type !== "wasl" || typeof payload.sub !== "string" || !/^\d+$/.test(payload.sub)) return null;
    const db = await getDb();
    if (!db) return null;
    const [user] = await db.select().from(users).where(eq(users.id, Number(payload.sub))).limit(1);
    if (!user || !user.waslAccount || user.accountStatus !== "active") return null;
    return user;
  } catch {
    return null;
  }
}

export async function touchWaslUser(userId: number) {
  const db = await getDb();
  if (db) await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export function hashPasswordResetToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function changeWaslPassword(user: User, currentPassword: string, nextPassword: string) {
  if (!validateWaslPassword(nextPassword)) throw new Error("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.");
  if (!(await verifyWaslPassword(currentPassword, user.passwordHash))) throw new Error("كلمة المرور الحالية غير صحيحة.");
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.update(users).set({ passwordHash: await hashWaslPassword(nextPassword) }).where(eq(users.id, user.id));
}

export async function createPasswordResetToken(user: User) {
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const rawToken = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS);
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashPasswordResetToken(rawToken), expiresAt });
  return { rawToken, expiresAt };
}

export async function resetWaslPassword(rawToken: string, nextPassword: string) {
  if (!validateWaslPassword(nextPassword)) throw new Error("كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.");
  const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const [record] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashPasswordResetToken(rawToken)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1);
  if (!record) throw new Error("رابط إعادة التعيين غير صالح أو انتهت صلاحيته.");
  await db.update(users).set({ passwordHash: await hashWaslPassword(nextPassword) }).where(eq(users.id, record.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }) {
  if (!ENV.resendApiKey) throw new Error("خدمة البريد غير مهيأة.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Wasl <onboarding@resend.dev>", to: [input.to], subject: "إعادة تعيين كلمة مرور وَصل", html: `<main dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7"><h2>إعادة تعيين كلمة المرور</h2><p>طلبت إعادة تعيين كلمة مرور حسابك في وَصل. الرابط صالح لمدة 30 دقيقة ويستخدم مرة واحدة فقط.</p><p><a href="${input.resetUrl}" style="display:inline-block;background:#7157F8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">تعيين كلمة مرور جديدة</a></p><p>إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p></main>` }) });
  if (!response.ok) throw new Error("تعذر إرسال رسالة إعادة التعيين.");
}

export async function sendWaslAccountInviteEmail(input: { to: string; setPasswordUrl: string; role: "user" | "admin" }) {
  if (!ENV.resendApiKey) throw new Error("خدمة البريد غير مهيأة.");
  const roleLabel = input.role === "admin" ? "مدير" : "مستخدم";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Wasl <onboarding@resend.dev>", to: [input.to], subject: "دعوة إلى حساب وَصل", html: `<main dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7"><h2>مرحبًا بك في وَصل</h2><p>أنشأ مدير المنصة حسابًا لك بصلاحية ${roleLabel}. اختر كلمة مرورك عبر الرابط التالي؛ الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة فقط.</p><p><a href="${input.setPasswordUrl}" style="display:inline-block;background:#7157F8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">تعيين كلمة المرور</a></p><p>إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل الرسالة.</p></main>` }) });
  if (!response.ok) throw new Error("تعذر إرسال دعوة الحساب.");
}
