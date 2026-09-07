import { randomBytes } from "node:crypto";
import { db } from "../../utils/db";
import { invites } from "../../utils/schema";
import { requireUserId } from "../../utils/session";

const LIFETIME_DAYS = 7;

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);

  const token = randomBytes(9).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(invites).values({ token, inviterId: userId, expiresAt });
  return { token, expiresAt: expiresAt.toISOString() };
});
