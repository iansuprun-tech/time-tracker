import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks, timeEntries } from "../../utils/schema";
import { stopRunning } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { blockId } = await readBody<{ blockId: number }>(event);

  // проверка владельца идёт до любой записи: Promise.all отвалится целиком,
  // если блок чужой, а параллельный запрос рядом с ней — только чтение
  const [, already] = await Promise.all([
    assertOwnBlock(userId, blockId),
    db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(and(eq(timeEntries.blockId, blockId), isNull(timeEntries.endedAt))),
  ]);

  // три записи в разные строки, зависимостей между ними нет —
  // держать их в цепочке значит трижды сходить до базы вместо одного раза
  await Promise.all([
    stopRunning(userId, blockId),
    already.length ? Promise.resolve() : db.insert(timeEntries).values({ blockId }),
    db.update(blocks).set({ status: "doing" }).where(eq(blocks.id, blockId)),
  ]);

  return { ok: true };
});
