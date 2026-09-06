import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, CURRENT_USER_ID } from "./db";
import { days, blocks, timeEntries, notes } from "./schema";

export async function ensureDay(date: string) {
  const [existing] = await db
    .select()
    .from(days)
    .where(and(eq(days.userId, CURRENT_USER_ID), eq(days.date, date)));
  if (existing) return existing;
  const [created] = await db.insert(days).values({ userId: CURRENT_USER_ID, date }).returning();
  return created!;
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
  const ids = await db.select({ id: blocks.id }).from(blocks).where(eq(blocks.dayId, dayId));
  if (ids.length === 0) return [];
  return db
    .select()
    .from(notes)
    .where(sql`${notes.blockId} in (${sql.join(ids.map((b) => sql`${b.id}`), sql`, `)})`)
    .orderBy(asc(notes.createdAt));
}

/** Интервал, забытый с прошлых суток — его длительности доверять нельзя */
export async function findStaleEntry() {
  const [stale] = await db
    .select({ entry: timeEntries, block: blocks })
    .from(timeEntries)
    .innerJoin(blocks, eq(blocks.id, timeEntries.blockId))
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(
      and(
        isNull(timeEntries.endedAt),
        eq(days.userId, CURRENT_USER_ID),
        sql`${timeEntries.startedAt} < now() - interval '10 hours'`,
      ),
    );
  return stale ?? null;
}

/** Останавливает все идущие таймеры пользователя, кроме указанного блока */
export async function stopRunning(exceptBlockId?: number) {
  const running = await db
    .select({ id: timeEntries.id, blockId: timeEntries.blockId })
    .from(timeEntries)
    .innerJoin(blocks, eq(blocks.id, timeEntries.blockId))
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(and(isNull(timeEntries.endedAt), eq(days.userId, CURRENT_USER_ID)));

  for (const r of running) {
    if (r.blockId === exceptBlockId) continue;
    await db.update(timeEntries).set({ endedAt: new Date() }).where(eq(timeEntries.id, r.id));
    await db
      .update(blocks)
      .set({ status: sql`case when ${blocks.status} = 'doing' then 'todo' else ${blocks.status} end` })
      .where(eq(blocks.id, r.blockId));
  }
}
