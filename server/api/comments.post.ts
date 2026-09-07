import { db } from "../utils/db";
import { comments } from "../utils/schema";
import { requireUserId } from "../utils/session";
import { assertCanComment } from "../utils/comments";
import { fail } from "../utils/http";

export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const body = await readBody<{ targetType: "day" | "block"; targetId: number; text: string }>(event);

  const text = (body.text ?? "").trim();
  if (!text) throw fail(400, "Пустой комментарий");

  await assertCanComment(viewerId, body.targetType, body.targetId);
  await db.insert(comments).values({
    targetType: body.targetType,
    targetId: body.targetId,
    authorId: viewerId,
    text,
  });

  return { ok: true };
});
