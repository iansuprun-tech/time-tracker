import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../utils/db";
import { comments, users } from "../utils/schema";
import { requireUserId } from "../utils/session";
import { assertCanComment } from "../utils/comments";
import { fail } from "../utils/http";

/**
 * Комментарии дня целиком: сам день плюс все его блоки.
 * Одним запросом, чтобы не дёргать по комментарию на каждый блок.
 */
export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const { dayId, blockIds } = getQuery(event) as { dayId?: string; blockIds?: string };
  if (!dayId) throw fail(400, "dayId обязателен");

  await assertCanComment(viewerId, "day", Number(dayId));

  const ids = (blockIds ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const rows = await db
    .select({
      id: comments.id,
      targetType: comments.targetType,
      targetId: comments.targetId,
      text: comments.text,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorName: users.name,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(
      ids.length
        ? and(
            eq(comments.targetType, "block"),
            inArray(comments.targetId, ids),
          )
        : and(eq(comments.targetType, "day"), eq(comments.targetId, Number(dayId))),
    )
    .orderBy(asc(comments.createdAt));

  const dayRows = ids.length
    ? await db
        .select({
          id: comments.id,
          targetType: comments.targetType,
          targetId: comments.targetId,
          text: comments.text,
          createdAt: comments.createdAt,
          authorId: comments.authorId,
          authorName: users.name,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(and(eq(comments.targetType, "day"), eq(comments.targetId, Number(dayId))))
        .orderBy(asc(comments.createdAt))
    : [];

  return [...rows, ...dayRows].map((c) => ({
    id: c.id,
    targetType: c.targetType,
    targetId: c.targetId,
    text: c.text,
    authorId: c.authorId,
    authorName: c.authorName,
    createdAt: c.createdAt.toISOString(),
  }));
});
