import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks, timeEntries } from "../../utils/schema";
import { stopRunning } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { blockId } = await readBody<{ blockId: number }>(event);
  await assertOwnBlock(userId, blockId);

  await stopRunning(userId, blockId);
  const [already] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.blockId, blockId), isNull(timeEntries.endedAt)));
  if (!already) await db.insert(timeEntries).values({ blockId });

  await db.update(blocks).set({ status: "doing" }).where(eq(blocks.id, blockId));
  return { ok: true };
});
