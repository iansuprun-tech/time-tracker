import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks, days, timeEntries } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";
import { TRASH_DAYS } from "../../utils/trash";

/**
 * Удаление мягкое: строка остаётся, из списков выпадает, вернуть можно из
 * корзины. Настоящее удаление уносило с собой заметки и комментарии, а
 * восстановить задачу значило завести её заново — со временем, местом
 * и всем разговором, которого уже нет.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);
  await assertOwnBlock(userId, id);

  await db.update(blocks).set({ deletedAt: new Date() }).where(eq(blocks.id, id));

  // идущий таймер удалённой задачи надо закрыть: иначе он тикает в пустоту
  await db
    .update(timeEntries)
    .set({ endedAt: new Date() })
    .where(and(eq(timeEntries.blockId, id), isNull(timeEntries.endedAt)));

  // корзина чистится сама, заодно с удалением: отдельного планировщика у нас нет
  await db.delete(blocks).where(
    and(
      lt(blocks.deletedAt, sql`now() - ${`${TRASH_DAYS} days`}::interval`),
      sql`${blocks.dayId} in (select ${days.id} from ${days} where ${days.userId} = ${userId})`,
    ),
  );

  return { ok: true };
});
