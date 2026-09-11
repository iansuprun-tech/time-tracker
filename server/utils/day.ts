import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { days, blocks, timeEntries, notes, comments } from "./schema";
import { fail } from "./http";

/** Только чтение: просмотр даты не должен плодить пустые дни в базе */
export async function findDay(userId: number, date: string) {
  const [row] = await db
    .select()
    .from(days)
    .where(and(eq(days.userId, userId), eq(days.date, date)));
  return row ?? null;
}

/** Пустая заготовка для дня, которого ещё нет: экран рисуется, строка не создаётся */
export function blankDay(userId: number, date: string) {
  return {
    id: 0,
    userId,
    date,
    status: "draft" as const,
    startedAt: null,
    finishedAt: null,
    mood: null,
    dayNote: null,
  };
}

/** Создаёт день — только там, где действительно что-то пишем */
export async function ensureDay(userId: number, date: string) {
  const [existing] = await db
    .select()
    .from(days)
    .where(and(eq(days.userId, userId), eq(days.date, date)));
  if (existing) return existing;
  const [created] = await db.insert(days).values({ userId, date }).returning();
  return created!;
}

/**
 * Плановое окно «с — по» в минутах от полуночи. Оба конца или ни одного:
 * половина окна на календаре не рисуется и смысла не несёт.
 */
export function plannedWindow(startMin?: number | null, endMin?: number | null) {
  if (startMin == null && endMin == null) return null;
  if (startMin == null || endMin == null) throw fail(400, "Нужно и начало, и конец");
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) throw fail(400, "Неверное время");
  if (startMin < 0 || endMin > 1440 || endMin <= startMin) throw fail(400, "Неверное время");
  return { start: startMin, end: endMin };
}

/** actualMin, выставленный руками, перекрывает сумму интервалов */
export async function getBlocks(dayId: number) {
  const rows = await db
    .select({
      block: blocks,
      trackedSec: sql<number>`coalesce(sum(extract(epoch from (coalesce(${timeEntries.endedAt}, now()) - ${timeEntries.startedAt}))), 0)`,
      runningSince: sql<string | null>`max(case when ${timeEntries.endedAt} is null then ${timeEntries.startedAt} end)`,
    })
    .from(blocks)
    .leftJoin(timeEntries, eq(timeEntries.blockId, blocks.id))
    .where(eq(blocks.dayId, dayId))
    .groupBy(blocks.id)
    .orderBy(asc(blocks.sort), asc(blocks.id));

  return rows.map((r) => ({
    ...r.block,
    trackedMin: Math.round(Number(r.trackedSec) / 60),
    runningSince: r.runningSince ? new Date(r.runningSince).toISOString() : null,
  }));
}

export type BlockDto = Awaited<ReturnType<typeof getBlocks>>[number];

export async function getBlockNotes(dayId: number) {
  return db
    .select({
      id: notes.id,
      blockId: notes.blockId,
      text: notes.text,
      isPrivate: notes.isPrivate,
      authorId: notes.authorId,
    })
    .from(notes)
    .innerJoin(blocks, eq(blocks.id, notes.blockId))
    .where(eq(blocks.dayId, dayId))
    .orderBy(asc(notes.createdAt));
}

/** Интервал, забытый с прошлых суток — его длительности доверять нельзя */
export async function findStaleEntry(userId: number) {
  const [stale] = await db
    .select({ entry: timeEntries, block: blocks })
    .from(timeEntries)
    .innerJoin(blocks, eq(blocks.id, timeEntries.blockId))
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(
      and(
        isNull(timeEntries.endedAt),
        eq(days.userId, userId),
        sql`${timeEntries.startedAt} < now() - interval '10 hours'`,
      ),
    );
  return stale ?? null;
}

/**
 * Останавливает все идущие таймеры пользователя, кроме указанного блока.
 * Одним UPDATE, а не выборкой и парой UPDATE на каждую строку: до базы далеко,
 * и на клике «Старт» цена лишнего захода видна глазом.
 */
export async function stopRunning(userId: number, exceptBlockId?: number) {
  const stopped = await db
    .update(timeEntries)
    .set({ endedAt: new Date() })
    .where(
      and(
        isNull(timeEntries.endedAt),
        exceptBlockId ? ne(timeEntries.blockId, exceptBlockId) : undefined,
        // таймер чужого блока трогать нельзя даже своими руками
        sql`${timeEntries.blockId} in (
          select ${blocks.id} from ${blocks}
          join ${days} on ${days.id} = ${blocks.dayId}
          where ${days.userId} = ${userId}
        )`,
      ),
    )
    .returning({ blockId: timeEntries.blockId });

  if (!stopped.length) return;

  await db
    .update(blocks)
    .set({ status: sql`case when ${blocks.status} = 'doing' then 'todo' else ${blocks.status} end` })
    .where(inArray(blocks.id, stopped.map((r) => r.blockId)));
}

/**
 * День, в котором ничего не осталось, хранить незачем.
 * Вызывается после удаления блока, чтобы база не копила пустые заготовки.
 */
export async function dropDayIfEmpty(dayId: number) {
  const [day] = await db.select().from(days).where(eq(days.id, dayId));
  if (!day || day.status !== "draft" || day.mood !== null || day.dayNote !== null) return;

  const [blockAgg] = await db
    .select({ count: sql<number>`count(*)` })
    .from(blocks)
    .where(eq(blocks.dayId, dayId));
  if (Number(blockAgg?.count ?? 0) > 0) return;

  const [commentAgg] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.targetType, "day"), eq(comments.targetId, dayId)));
  if (Number(commentAgg?.count ?? 0) > 0) return;

  await db.delete(days).where(eq(days.id, dayId));
}
