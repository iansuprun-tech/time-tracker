import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../utils/db";
import { users, days, blocks, timeEntries } from "../utils/schema";
import { requireUserId } from "../utils/session";
import { assertCanView } from "../utils/access";
import { fail } from "../utils/http";
import { shiftDays } from "../../shared/utils/date";

/**
 * Неделя фактом: интервалы таймера за семь дней от понедельника.
 * План в календарь не ложится — у блоков есть длительность, но нет времени начала.
 */
export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const { from, userId } = getQuery(event) as { from?: string; userId?: string };
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw fail(400, "from обязателен");

  const ownerId = userId ? Number(userId) : viewerId;
  await assertCanView(viewerId, ownerId);

  const to = shiftDays(from, 6);
  // интервал, начатый в воскресенье вечером, переходит за полночь в понедельник
  const since = shiftDays(from, -1);

  const [rows, dayRows, owner] = await Promise.all([
    db
      .select({
        blockId: blocks.id,
        date: days.date,
        title: blocks.title,
        category: blocks.category,
        location: blocks.location,
        status: blocks.status,
        isUnplanned: blocks.isUnplanned,
        plannedMin: blocks.plannedMin,
        kind: blocks.kind,
        startMin: blocks.plannedStartMin,
        endMin: blocks.plannedEndMin,
        sort: blocks.sort,
        entryId: timeEntries.id,
        startedAt: timeEntries.startedAt,
        endedAt: timeEntries.endedAt,
      })
      .from(blocks)
      .innerJoin(days, eq(days.id, blocks.dayId))
      .leftJoin(timeEntries, eq(timeEntries.blockId, blocks.id))
      .where(and(eq(days.userId, ownerId), gte(days.date, since), lte(days.date, to)))
      .orderBy(asc(days.date), asc(blocks.sort), asc(blocks.id)),
    db
      .select({
        date: days.date,
        status: days.status,
        mood: days.mood,
        startedAt: days.startedAt,
      })
      .from(days)
      .where(and(eq(days.userId, ownerId), gte(days.date, from), lte(days.date, to))),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, ownerId)),
  ]);

  const entries = rows
    .filter((r) => r.entryId !== null)
    .map((r) => ({
      id: r.entryId!,
      blockId: r.blockId,
      title: r.title,
      category: r.category,
      location: r.location,
      status: r.status,
      isUnplanned: r.isUnplanned,
      startedAt: r.startedAt!.toISOString(),
      endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    }));

  // каждый блок один раз: интервалы размножили строки джойном.
  // раскладку по часам считает клиент — у него часовой пояс и он же её рисует
  const planBlocks = rows
    .filter((r, i, all) => all.findIndex((x) => x.blockId === r.blockId) === i)
    .filter((r) => r.date >= from)
    .map((r) => ({
      id: r.blockId,
      date: r.date,
      title: r.title,
      category: r.category,
      location: r.location,
      status: r.status,
      isUnplanned: r.isUnplanned,
      kind: r.kind,
      plannedMin: r.plannedMin,
      plannedStartMin: r.startMin,
      plannedEndMin: r.endMin,
      sort: r.sort,
      tracked: entries.some((e) => e.blockId === r.blockId),
    }))
    .sort((a, b) => a.sort - b.sort || a.id - b.id);

  return {
    from,
    to,
    readonly: ownerId !== viewerId,
    owner: owner[0] ?? null,
    days: dayRows.map((d) => ({
      date: d.date,
      status: d.status,
      mood: d.mood,
      startedAt: d.startedAt ? d.startedAt.toISOString() : null,
    })),
    entries,
    blocks: planBlocks,
  };
});
