import { eq } from "drizzle-orm";
import { db } from "../utils/db";
import { users } from "../utils/schema";
import { findDay, blankDay, getBlocks, getBlockNotes, findStaleEntry } from "../utils/day";
import { requireUserId } from "../utils/session";
import { assertCanView } from "../utils/access";
import { fail } from "../utils/http";

export default defineEventHandler(async (event) => {
  const viewerId = await requireUserId(event);
  const { date, userId } = getQuery(event) as { date?: string; userId?: string };
  if (!date) throw fail(400, "date обязателен");

  const ownerId = userId ? Number(userId) : viewerId;
  await assertCanView(viewerId, ownerId);
  const readonly = ownerId !== viewerId;

  const day = (await findDay(ownerId, date)) ?? blankDay(ownerId, date);
  const [blocks, notes, stale, owner] = await Promise.all([
    day.id ? getBlocks(day.id) : Promise.resolve([]),
    day.id ? getBlockNotes(day.id) : Promise.resolve([]),
    // чужой забытый таймер закрывать не нам
    readonly ? Promise.resolve(null) : findStaleEntry(ownerId),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, ownerId)),
  ]);

  return {
    day,
    owner: owner[0] ?? null,
    readonly,
    blocks,
    notes: notes
      // личную заметку видит только автор
      .filter((n) => !n.isPrivate || n.authorId === viewerId)
      .map((n) => ({ id: n.id, blockId: n.blockId, text: n.text })),
    stale: stale
      ? {
          entryId: stale.entry.id,
          title: stale.block.title,
          startedAt: stale.entry.startedAt.toISOString(),
        }
      : null,
  };
});
