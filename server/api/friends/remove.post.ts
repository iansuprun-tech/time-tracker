import { and, eq, or } from "drizzle-orm";
import { db } from "../../utils/db";
import { friendships } from "../../utils/schema";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, id),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );

  return { ok: true };
});
