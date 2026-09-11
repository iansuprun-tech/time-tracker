import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { stopRunning, plannedWindow } from "../../utils/day";
import { requireUserId } from "../../utils/session";
import { assertOwnBlock } from "../../utils/access";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{
    id: number;
    status?: string;
    actualMin?: number | null;
    title?: string;
    category?: string | null;
    /** окно целиком: обе границы или обе null — «убрать время» */
    startMin?: number | null;
    endMin?: number | null;
  }>(event);

  await assertOwnBlock(userId, body.id);
  if (body.status && body.status !== "doing") await stopRunning(userId);

  const touchesWindow = body.startMin !== undefined || body.endMin !== undefined;
  const window = touchesWindow ? plannedWindow(body.startMin, body.endMin) : null;
  const span = window ? window.end - window.start : null;

  const [block] = touchesWindow
    ? await db.select({ kind: blocks.kind }).from(blocks).where(eq(blocks.id, body.id))
    : [];

  await db
    .update(blocks)
    .set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.title ? { title: body.title } : {}),
      ...(body.actualMin !== undefined ? { actualMin: body.actualMin } : {}),
      ...(body.category !== undefined ? { category: body.category?.trim() || null } : {}),
      ...(touchesWindow
        ? {
            plannedStartMin: window?.start ?? null,
            plannedEndMin: window?.end ?? null,
            plannedMin: span,
            // у офлайна окно и есть факт, у онлайна факт остаётся за таймером
            ...(block?.kind === "offline" ? { actualMin: span } : {}),
          }
        : {}),
    })
    .where(eq(blocks.id, body.id));

  return { ok: true };
});
