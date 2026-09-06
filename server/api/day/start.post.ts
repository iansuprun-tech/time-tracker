import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { days } from "../../utils/schema";
import { ensureDay } from "../../utils/day";

export default defineEventHandler(async (event) => {
  const { date } = await readBody<{ date: string }>(event);
  const day = await ensureDay(date);
  if (day.status !== "draft") return { ok: true };

  await db
    .update(days)
    .set({ status: "started", startedAt: new Date() })
    .where(eq(days.id, day.id));
  return { ok: true };
});
