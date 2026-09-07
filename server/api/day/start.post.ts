import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { days } from "../../utils/schema";
import { ensureDay } from "../../utils/day";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { date } = await readBody<{ date: string }>(event);
  const day = await ensureDay(userId, date);
  if (day.status !== "draft") return { ok: true };

  await db
    .update(days)
    .set({ status: "started", startedAt: new Date() })
    .where(eq(days.id, day.id));
  return { ok: true };
});
