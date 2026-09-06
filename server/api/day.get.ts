import { ensureDay, getBlocks, getBlockNotes, findStaleEntry } from "../utils/day";

export default defineEventHandler(async (event) => {
  const { date } = getQuery(event) as { date?: string };
  if (!date) throw createError({ statusCode: 400, message: "date обязателен" });

  const day = await ensureDay(date);
  const [blocks, notes, stale] = await Promise.all([
    getBlocks(day.id),
    getBlockNotes(day.id),
    findStaleEntry(),
  ]);

  return {
    day,
    blocks,
    notes: notes.map((n) => ({ id: n.id, blockId: n.blockId, text: n.text })),
    stale: stale
      ? { entryId: stale.entry.id, title: stale.block.title, startedAt: stale.entry.startedAt.toISOString() }
      : null,
  };
});
