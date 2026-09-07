import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";
import { dropDayIfEmpty } from "../../utils/day";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);
  await assertOwnBlock(userId, id);

  const [row] = await db.select({ dayId: blocks.dayId }).from(blocks).where(eq(blocks.id, id));
  await db.delete(blocks).where(eq(blocks.id, id));
  if (row) await dropDayIfEmpty(row.dayId);

  return { ok: true };
});
