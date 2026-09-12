import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { passwordResets } from "./schema";

/** Час: за это время человек успевает дойти до почты, а украденная ссылка успевает протухнуть */
export const RESET_TTL_MIN = 60;
/** Чаще раза в минуту письмо не уходит — иначе ящик легко завалить чужими руками */
const COOLDOWN_SEC = 60;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

/** true — письмо недавно уже уходило, второе слать не нужно */
export async function sentRecently(userId: number) {
  const [last] = await db
    .select({ createdAt: passwordResets.createdAt })
    .from(passwordResets)
    .where(eq(passwordResets.userId, userId))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1);

  if (!last) return false;
  return Date.now() - last.createdAt.getTime() < COOLDOWN_SEC * 1000;
}

/** Живой неиспользованный токен; сравнение хешей — постоянное по времени */
export async function findLiveReset(token: string) {
  const hash = hashToken(token);
  const rows = await db
    .select()
    .from(passwordResets)
    .where(and(isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));

  const wanted = Buffer.from(hash, "hex");
  return (
    rows.find((r) => {
      const got = Buffer.from(r.tokenHash, "hex");
      return got.length === wanted.length && timingSafeEqual(got, wanted);
    }) ?? null
  );
}
