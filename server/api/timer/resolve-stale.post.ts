import { eq, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks, timeEntries } from "../../utils/schema";

/** Забытый таймер закрываем указанным числом минут, а не реальной длительностью */
export default defineEventHandler(async (event) => {
  const { entryId, minutes } = await readBody<{ entryId: number; minutes: number }>(event);

  const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, entryId));
  if (!entry) throw createError({ statusCode: 404, message: "Интервал не найден" });

  const ended = new Date(entry.startedAt.getTime() + minutes * 60_000);
  await db.update(timeEntries).set({ endedAt: ended }).where(eq(timeEntries.id, entryId));
  await db
    .update(blocks)
    .set({ status: sql`case when ${blocks.status} = 'doing' then 'todo' else ${blocks.status} end` })
    .where(eq(blocks.id, entry.blockId));

  return { ok: true };
});
