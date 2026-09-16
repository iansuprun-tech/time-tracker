import { eq, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { ensureDay, stopRunning, plannedWindow } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";
import { rememberPreset } from "../../utils/presets";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{
    id: number;
    status?: string;
    actualMin?: number | null;
    title?: string;
    category?: string | null;
    project?: string | null;
    location?: string | null;
    /** окно целиком: обе границы или обе null — «убрать время» */
    startMin?: number | null;
    endMin?: number | null;
    plannedMin?: number | null;
    /** перенос задачи в другой день */
    date?: string;
  }>(event);

  await assertOwnBlock(userId, body.id);
  if (body.status && body.status !== "doing") await stopRunning(userId);

  const touchesWindow = body.startMin !== undefined || body.endMin !== undefined;
  const window = touchesWindow ? plannedWindow(body.startMin, body.endMin) : null;
  const span = window ? window.end - window.start : null;

  const [block] = touchesWindow
    ? await db.select({ kind: blocks.kind }).from(blocks).where(eq(blocks.id, body.id))
    : [];

  /**
   * Перенос в другой день. `is_unplanned` не трогаем: он помнит, входила ли
   * задача в план, когда её заводили, — перенос эту историю не переписывает.
   */
  let move: { dayId: number; sort: number } | undefined;
  if (body.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw fail(400, "Неверная дата");
    const day = await ensureDay(userId, body.date);
    const [agg] = await db
      .select({ max: sql<number>`coalesce(max(${blocks.sort}), 0)` })
      .from(blocks)
      .where(eq(blocks.dayId, day.id));
    // в новом дне задача встаёт в конец: своего места в чужом порядке у неё нет
    move = { dayId: day.id, sort: Number(agg?.max ?? 0) + 1 };
  }

  await db
    .update(blocks)
    .set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.title ? { title: body.title } : {}),
      ...(body.actualMin !== undefined ? { actualMin: body.actualMin } : {}),
      ...(body.category !== undefined ? { category: body.category?.trim() || null } : {}),
      ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
      ...(body.project !== undefined ? { project: body.project?.trim() || null } : {}),
      ...(move ?? {}),
      ...(touchesWindow
        ? {
            plannedStartMin: window?.start ?? null,
            plannedEndMin: window?.end ?? null,
            // окно задаёт длительность само; когда его сняли — её задают руками
            plannedMin: span ?? (body.plannedMin !== undefined ? body.plannedMin : null),
            // у офлайна окно и есть факт, у онлайна факт остаётся за таймером
            ...(block?.kind === "offline" ? { actualMin: span } : {}),
          }
        : body.plannedMin !== undefined
          ? { plannedMin: body.plannedMin }
          : {}),
    })
    .where(eq(blocks.id, body.id));

  await Promise.all([
    rememberPreset(userId, "category", body.category),
    rememberPreset(userId, "place", body.location),
    rememberPreset(userId, "project", body.project),
  ]);

  return { ok: true };
});
