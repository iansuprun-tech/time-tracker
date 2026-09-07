import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { stopRunning } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{
    id: number;
    status?: string;
    actualMin?: number | null;
    title?: string;
    category?: string | null;
  }>(event);

  await assertOwnBlock(userId, body.id);
  if (body.status && body.status !== "doing") await stopRunning(userId);

  await db
    .update(blocks)
    .set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.title ? { title: body.title } : {}),
      ...(body.actualMin !== undefined ? { actualMin: body.actualMin } : {}),
      ...(body.category !== undefined ? { category: body.category?.trim() || null } : {}),
    })
    .where(eq(blocks.id, body.id));

  return { ok: true };
});
