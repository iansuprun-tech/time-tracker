import { ensureDay, getBlocks, getBlockNotes } from "../utils/day";
import { buildStandup } from "../utils/standup";
import { nextDay } from "../../shared/utils/date";

export default defineEventHandler(async (event) => {
  const { date } = getQuery(event) as { date?: string };
  if (!date) throw createError({ statusCode: 400, message: "date обязателен" });

  const day = await ensureDay(date);
  const next = await ensureDay(nextDay(date));

  const [blocks, notes, tomorrow] = await Promise.all([
    getBlocks(day.id),
    getBlockNotes(day.id),
    getBlocks(next.id),
  ]);

  return {
    text: buildStandup({
      date,
      blocks,
      notes: notes.map((n) => ({ blockId: n.blockId, text: n.text })),
      tomorrow,
    }),
  };
});
