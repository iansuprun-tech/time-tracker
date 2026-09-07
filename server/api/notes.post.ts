import { db } from "../utils/db";
import { requireUserId } from "../utils/session";
import { assertOwnBlock } from "../utils/access";
import { notes } from "../utils/schema";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { blockId, text } = await readBody<{ blockId: number; text: string }>(event);
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw createError({ statusCode: 400, message: "Пустая заметка" });

  await assertOwnBlock(userId, blockId);
  await db.insert(notes).values({ blockId, authorId: userId, text: trimmed });
  return { ok: true };
});
