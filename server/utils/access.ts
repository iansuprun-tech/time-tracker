import { and, eq, or } from "drizzle-orm";
import { db } from "./db";
import { blocks, days, friendships } from "./schema";

/**
 * Кто владелец блока. Эндпоинты принимают id блока снаружи,
 * поэтому владельца надо проверять на каждой записи, а не доверять интерфейсу.
 */
export async function assertOwnBlock(userId: number, blockId: number) {
  const [row] = await db
    .select({ ownerId: days.userId })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(eq(blocks.id, blockId));

  if (!row) throw createError({ statusCode: 404, message: "Блок не найден" });
  if (row.ownerId !== userId) throw createError({ statusCode: 403, message: "Чужой блок" });
  return row.ownerId;
}

export async function areFriends(a: number, b: number) {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
        ),
      ),
    );
  return Boolean(row);
}

/** Свой день видно всегда, чужой — только у подтверждённого друга */
export async function canView(viewerId: number, ownerId: number) {
  return viewerId === ownerId || (await areFriends(viewerId, ownerId));
}

export async function assertCanView(viewerId: number, ownerId: number) {
  if (!(await canView(viewerId, ownerId))) {
    throw createError({ statusCode: 403, message: "Нет доступа к этому дню" });
  }
}
