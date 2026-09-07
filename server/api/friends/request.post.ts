import { and, eq, or } from "drizzle-orm";
import { db } from "../../utils/db";
import { friendships, users } from "../../utils/schema";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { email } = await readBody<{ email: string }>(event);
  const target = (email ?? "").trim().toLowerCase();

  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.email, target));
  if (!other) throw createError({ statusCode: 404, message: "Такого пользователя нет" });
  if (other.id === userId) throw createError({ statusCode: 400, message: "Это вы" });

  const [existing] = await db
    .select({ id: friendships.id, status: friendships.status, requesterId: friendships.requesterId })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, other.id)),
        and(eq(friendships.requesterId, other.id), eq(friendships.addresseeId, userId)),
      ),
    );

  // встречная заявка = обоюдное согласие, подтверждаем сразу
  if (existing) {
    if (existing.status === "pending" && existing.requesterId === other.id) {
      await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, existing.id));
      return { status: "accepted" };
    }
    return { status: existing.status };
  }

  await db.insert(friendships).values({ requesterId: userId, addresseeId: other.id });
  return { status: "pending" };
});
