import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq, and } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { users, type User } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { getSessionCookieOptions } from "../_core/cookies";
import type { Request, Response } from "express";

const scrypt = promisify(scryptCallback);
export const WASL_SESSION_COOKIE = "wasl_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

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
