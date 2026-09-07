import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);
  await assertOwnBlock(userId, id);
  await db.delete(blocks).where(eq(blocks.id, id));
  return { ok: true };
});
