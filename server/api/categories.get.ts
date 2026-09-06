import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, CURRENT_USER_ID } from "../utils/db";
import { blocks, days } from "../utils/schema";

/** Ранее использованные категории — для подсказок в поле ввода */
export default defineEventHandler(async () => {
  const rows = await db
    .selectDistinct({ category: blocks.category })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(and(eq(days.userId, CURRENT_USER_ID), isNotNull(blocks.category)))
    .orderBy(sql`1`);

  return rows.map((r) => r.category!).filter(Boolean);
});
