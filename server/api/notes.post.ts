import { db } from "../utils/db";
import { requireUserId } from "../utils/session";
import { assertOwnBlock } from "../utils/access";
import { notes } from "../utils/schema";
import { fail } from "../utils/http";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { blockId, text } = await readBody<{ blockId: number; text: string }>(event);
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw fail(400, "Пустая заметка");

  await assertOwnBlock(userId, blockId);
  await db.insert(notes).values({ blockId, authorId: userId, text: trimmed });
  return { ok: true };
});
