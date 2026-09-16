import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";
import { fail } from "../../utils/http";

/** Вернуть задачу из корзины — со всеми заметками, комментариями и таймингами */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);
  await assertOwnBlock(userId, id);

  const [row] = await db.select({ deletedAt: blocks.deletedAt }).from(blocks).where(eq(blocks.id, id));
  if (!row) throw fail(404, "Блок не найден");
  if (!row.deletedAt) return { ok: true };

  await db.update(blocks).set({ deletedAt: null }).where(eq(blocks.id, id));
  return { ok: true };
});
