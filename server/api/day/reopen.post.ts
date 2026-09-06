import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { days } from "../../utils/schema";
import { ensureDay } from "../../utils/day";

/** День закрыли рано, а работа продолжилась — план при этом остаётся замороженным */
export default defineEventHandler(async (event) => {
  const { date } = await readBody<{ date: string }>(event);
  const day = await ensureDay(date);

  await db
    .update(days)
    .set({ status: "started", finishedAt: null })
    .where(eq(days.id, day.id));

  return { ok: true };
});
