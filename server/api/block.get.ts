import { asc, eq } from "drizzle-orm";
import { db } from "../utils/db";
import { blocks, comments, days, notes, timeEntries, users } from "../utils/schema";
import { requireUserId } from "../utils/session";
import { assertCanView } from "../utils/access";
import { fail } from "../utils/http";

/**
 * Одна задача целиком: сам блок, его заметки и комментарии.
 * Нужна календарю — там у блока есть только название и часы, а открыть хочется
 * всё. Тащить это в недельную выдачу нельзя: семь дней задач со всеми
 * разговорами приедут в каждый заход на главную ради одной, которую откроют.
 */
export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const { id } = getQuery(event) as { id?: string };
  const blockId = Number(id);
  if (!Number.isFinite(blockId) || blockId <= 0) throw fail(400, "id обязателен");

  const [row] = await db
    .select({ block: blocks, date: days.date, ownerId: days.userId })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(eq(blocks.id, blockId));
  if (!row) throw fail(404, "Блок не найден");

  // чужую задачу видно только у друга — интерфейс тут не защита
  await assertCanView(viewerId, row.ownerId);

  const [noteRows, commentRows, trackedRows] = await Promise.all([
    db
      .select({ id: notes.id, text: notes.text, isPrivate: notes.isPrivate, authorId: notes.authorId })
      .from(notes)
      .where(eq(notes.blockId, blockId))
      .orderBy(asc(notes.createdAt)),
    db
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
      .where(eq(comments.targetId, blockId))
      .orderBy(asc(comments.createdAt)),
    db
      .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
      .from(timeEntries)
      .where(eq(timeEntries.blockId, blockId)),
  ]);

  const trackedSec = trackedRows.reduce(
    (sum, e) => sum + ((e.endedAt ?? new Date()).getTime() - e.startedAt.getTime()) / 1000,
    0,
  );

  return {
    block: {
      ...row.block,
      date: row.date,
      trackedMin: Math.round(trackedSec / 60),
      runningSince: trackedRows.find((e) => !e.endedAt)?.startedAt.toISOString() ?? null,
    },
    readonly: row.ownerId !== viewerId,
    // личную заметку видит только автор
    notes: noteRows.filter((n) => !n.isPrivate || n.authorId === viewerId).map((n) => ({ id: n.id, text: n.text })),
    comments: commentRows
      // targetId у дня и у блока живут в одной таблице — чужие строки сюда попадать не должны
      .filter((c) => c.targetType === "block")
      .map((c) => ({
        id: c.id,
        targetType: c.targetType,
        targetId: c.targetId,
        text: c.text,
        authorId: c.authorId,
        authorName: c.authorName,
        createdAt: c.createdAt.toISOString(),
      })),
  };
});
