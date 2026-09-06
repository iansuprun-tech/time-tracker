import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { ensureDay } from "../../utils/day";

/** Перенос плана с одного дня на другой — снимает трение вечернего планирования */
export default defineEventHandler(async (event) => {
  const { fromDate, toDate } = await readBody<{ fromDate: string; toDate: string }>(event);

  const from = await ensureDay(fromDate);
  const to = await ensureDay(toDate);
  if (to.status !== "draft") {
    throw createError({ statusCode: 400, message: "День уже начат, план заморожен" });
  }

  const source = await db
    .select()
    .from(blocks)
    .where(eq(blocks.dayId, from.id))
    .orderBy(asc(blocks.sort), asc(blocks.id));

  // отменённое и незапланированное не тащим — копируем именно план, а не историю дня
  const worth = source.filter((b) => b.status !== "dropped" && !b.isUnplanned);
  if (worth.length === 0) return { copied: 0 };

  const [agg] = await db
    .select({ max: sql<number>`coalesce(max(${blocks.sort}), 0)` })
    .from(blocks)
    .where(eq(blocks.dayId, to.id));
  const max = Number(agg?.max ?? 0);

  await db.insert(blocks).values(
    worth.map((b, i) => ({
      dayId: to.id,
      title: b.title,
      category: b.category,
      plannedMin: b.plannedMin,
      sort: max + i + 1,
    })),
  );

  return { copied: worth.length };
});
