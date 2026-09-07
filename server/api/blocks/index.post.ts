import { eq, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { ensureDay } from "../../utils/day";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{
    date: string;
    title: string;
    plannedMin?: number | null;
    category?: string | null;
  }>(event);
  const title = (body.title ?? "").trim();
  if (!title) throw createError({ statusCode: 400, message: "Пустой блок" });

  const day = await ensureDay(userId, body.date);
  const [agg] = await db
    .select({ max: sql<number>`coalesce(max(${blocks.sort}), 0)` })
    .from(blocks)
    .where(eq(blocks.dayId, day.id));
  const max = Number(agg?.max ?? 0);

  const [created] = await db
    .insert(blocks)
    .values({
      dayId: day.id,
      title,
      plannedMin: body.plannedMin || null,
      category: body.category?.trim() || null,
      sort: max + 1,
      // всё, что заведено после старта дня, в план не входило
      isUnplanned: day.status === "started",
    })
    .returning();

  return created;
});
