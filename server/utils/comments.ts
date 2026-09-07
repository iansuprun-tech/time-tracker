import { eq } from "drizzle-orm";
import { db } from "./db";
import { blocks, days } from "./schema";
import { assertCanView } from "./access";
import { fail } from "./http";

/** Комментарий всегда висит на чьём-то дне — находим владельца и проверяем доступ */
export async function assertCanComment(
  viewerId: number,
  targetType: string,
  targetId: number,
) {
  if (targetType === "day") {
    const [day] = await db.select({ userId: days.userId }).from(days).where(eq(days.id, targetId));
    if (!day) throw fail(404, "День не найден");
    await assertCanView(viewerId, day.userId);
    return;
  }

  if (targetType === "block") {
    const [row] = await db
      .select({ ownerId: days.userId })
      .from(blocks)
      .innerJoin(days, eq(days.id, blocks.dayId))
      .where(eq(blocks.id, targetId));
    if (!row) throw fail(404, "Блок не найден");
    await assertCanView(viewerId, row.ownerId);
    return;
  }

  throw fail(400, "Неизвестный тип цели");
}
