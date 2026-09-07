import { findDay, getBlocks, getBlockNotes } from "../utils/day";
import { buildStandup } from "../utils/standup";
import { nextDay } from "../../shared/utils/date";
import { requireUserId } from "../utils/session";
import { assertCanView } from "../utils/access";
import { fail } from "../utils/http";

export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const { date, userId } = getQuery(event) as { date?: string; userId?: string };
  if (!date) throw fail(400, "date обязателен");

  const ownerId = userId ? Number(userId) : viewerId;
  await assertCanView(viewerId, ownerId);

  const day = await findDay(ownerId, date);
  const next = await findDay(ownerId, nextDay(date));

  const [blocks, notes, tomorrow] = await Promise.all([
    day ? getBlocks(day.id) : Promise.resolve([]),
    day ? getBlockNotes(day.id) : Promise.resolve([]),
    next ? getBlocks(next.id) : Promise.resolve([]),
  ]);

  return {
    text: buildStandup({
      date,
      blocks,
      notes: notes
        .filter((n) => !n.isPrivate || n.authorId === viewerId)
        .map((n) => ({ blockId: n.blockId, text: n.text })),
      tomorrow,
    }),
  };
});
