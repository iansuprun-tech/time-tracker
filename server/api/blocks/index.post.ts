import { eq, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { ensureDay, plannedWindow } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{
    date: string;
    title: string;
    plannedMin?: number | null;
    category?: string | null;
    /** online — время натикает таймером, offline — вписано руками */
    kind?: string;
    startMin?: number | null;
    endMin?: number | null;
  }>(event);
  const title = (body.title ?? "").trim();
  if (!title) throw fail(400, "Пустой блок");

  const kind = body.kind === "offline" ? "offline" : "online";
  const window = plannedWindow(body.startMin, body.endMin);
  // офлайн-задача целиком описывается своим окном: без него от неё ничего не остаётся
  if (kind === "offline" && !window) throw fail(400, "У офлайн-задачи нужно время с и по");
  const span = window ? window.end - window.start : null;

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
      plannedMin: span ?? body.plannedMin ?? null,
      // таймера по офлайну не будет, поэтому окно сразу и есть факт
      actualMin: kind === "offline" ? span : null,
      kind,
      plannedStartMin: window?.start ?? null,
      plannedEndMin: window?.end ?? null,
      category: body.category?.trim() || null,
      sort: max + 1,
      // всё, что заведено после старта дня, в план не входило
      isUnplanned: day.status === "started",
    })
    .returning();

  return created;
});
