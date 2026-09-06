import { db, CURRENT_USER_ID } from "../utils/db";
import { notes } from "../utils/schema";

export default defineEventHandler(async (event) => {
  const { blockId, text } = await readBody<{ blockId: number; text: string }>(event);
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw createError({ statusCode: 400, message: "Пустая заметка" });

  await db.insert(notes).values({ blockId, authorId: CURRENT_USER_ID, text: trimmed });
  return { ok: true };
});
