import { and, eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { friendships } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { fail } from "../../utils/http";

/** Отвечать на заявку может только её адресат */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id, accept } = await readBody<{ id: number; accept: boolean }>(event);

  const [row] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.id, id), eq(friendships.addresseeId, userId)));
  if (!row) throw fail(404, "Заявка не найдена");

  if (accept) await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, id));
  else await db.delete(friendships).where(eq(friendships.id, id));

  return { ok: true };
});
