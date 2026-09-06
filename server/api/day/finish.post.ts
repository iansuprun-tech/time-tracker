import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { days } from "../../utils/schema";
import { ensureDay, stopRunning } from "../../utils/day";

export default defineEventHandler(async (event) => {
  const { date, mood, dayNote } = await readBody<{
    date: string;
    mood?: number | null;
    dayNote?: string | null;
  }>(event);

  const day = await ensureDay(date);
  // день закрыт — таймеры идти не должны
  await stopRunning();

  await db
    .update(days)
    .set({
      status: "finished",
      finishedAt: new Date(),
      mood: mood ?? null,
      dayNote: dayNote?.trim() || null,
    })
    .where(eq(days.id, day.id));

  return { ok: true };
});
