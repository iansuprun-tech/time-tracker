import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../utils/db";
import { requireUserId } from "../utils/session";
import { blocks, days } from "../utils/schema";

/** Ранее использованные категории — для подсказок в поле ввода */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const rows = await db
    .selectDistinct({ category: blocks.category })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(and(eq(days.userId, userId), isNotNull(blocks.category)))
    .orderBy(sql`1`);

  return rows.map((r) => r.category!).filter(Boolean);
});
