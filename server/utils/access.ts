import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import { blocks, days, friendships } from "./schema";
import { fail } from "./http";

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

  if (!row) throw fail(404, "Блок не найден");
  if (row.ownerId !== userId) throw fail(403, "Чужой блок");
  return row.ownerId;
}

/**
 * Пачка блоков разом: все свои и все из одного дня —
 * иначе это не перестановка внутри списка, а что-то другое.
 */
export async function assertOwnBlocks(userId: number, blockIds: number[]) {
  const rows = await db
    .select({ dayId: blocks.dayId, ownerId: days.userId })
    .from(blocks)
    .innerJoin(days, eq(days.id, blocks.dayId))
    .where(inArray(blocks.id, blockIds));

  if (rows.length !== blockIds.length) throw fail(404, "Блок не найден");
  if (rows.some((r) => r.ownerId !== userId)) throw fail(403, "Чужой блок");

  const dayId = rows[0]!.dayId;
  if (rows.some((r) => r.dayId !== dayId)) throw fail(400, "Блоки из разных дней");
  return dayId;
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
    throw fail(403, "Нет доступа к этому дню");
  }
}
