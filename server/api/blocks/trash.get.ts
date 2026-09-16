import { and, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks, comments, days, notes } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { TRASH_DAYS } from "../../utils/trash";

/**
 * Корзина: что удалено за последние TRASH_DAYS дней и что при этом уедет
 * вместе с задачей, если её не вернуть. Счётчики заметок и комментариев —
 * чтобы было видно, что теряется: ради них всё и затевалось.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);

  const stale = sql`now() - ${`${TRASH_DAYS} days`}::interval`;
  const mine = sql`${blocks.dayId} in (select ${days.id} from ${days} where ${days.userId} = ${userId})`;

  // просроченное вычищаем по ходу: планировщика у нас нет
  await db.delete(blocks).where(and(lt(blocks.deletedAt, stale), mine));

  const rows = await db
    .select({
      id: blocks.id,
      title: blocks.title,
      date: days.date,
      project: blocks.project,
      category: blocks.category,
      location: blocks.location,
      kind: blocks.kind,
      plannedMin: blocks.plannedMin,
      plannedStartMin: blocks.plannedStartMin,
      plannedEndMin: blocks.plannedEndMin,
      deletedAt: blocks.deletedAt,
      notes: sql<number>`(select count(*) from ${notes} where ${notes.blockId} = ${blocks.id})`,
      comments: sql<number>`(select count(*) from ${comments} where ${comments.targetType} = 'block' and ${comments.targetId} = ${blocks.id})`,
    })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(and(eq(days.userId, userId), isNotNull(blocks.deletedAt)))
    .orderBy(desc(blocks.deletedAt));

  return {
    keepDays: TRASH_DAYS,
    items: rows.map((r) => ({
      ...r,
      notes: Number(r.notes),
      comments: Number(r.comments),
      deletedAt: r.deletedAt!.toISOString(),
    })),
  };
});
