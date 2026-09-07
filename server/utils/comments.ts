import { eq } from "drizzle-orm";
import { db } from "./db";
import { blocks, days } from "./schema";
import { assertCanView } from "./access";

/** Комментарий всегда висит на чьём-то дне — находим владельца и проверяем доступ */
export async function assertCanComment(
  viewerId: number,
  targetType: string,
  targetId: number,
) {
  if (targetType === "day") {
    const [day] = await db.select({ userId: days.userId }).from(days).where(eq(days.id, targetId));
    if (!day) throw createError({ statusCode: 404, message: "День не найден" });
    await assertCanView(viewerId, day.userId);
    return;
  }

  if (targetType === "block") {
    const [row] = await db
      .select({ ownerId: days.userId })
      .from(blocks)
      .innerJoin(days, eq(days.id, blocks.dayId))
      .where(eq(blocks.id, targetId));
    if (!row) throw createError({ statusCode: 404, message: "Блок не найден" });
    await assertCanView(viewerId, row.ownerId);
    return;
  }

  throw createError({ statusCode: 400, message: "Неизвестный тип цели" });
}
