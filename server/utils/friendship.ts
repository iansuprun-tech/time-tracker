import { and, eq, or } from "drizzle-orm";
import { db } from "./db";
import { friendships } from "./schema";

/** Подружить двоих сразу, без стадии заявки. Повторный вызов безопасен. */
export async function makeFriends(a: number, b: number) {
  if (a === b) return;

  const [existing] = await db
    .select({ id: friendships.id, status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    );

  if (existing) {
    if (existing.status !== "accepted") {
      await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, existing.id));
    }
    return;
  }

  await db.insert(friendships).values({ requesterId: a, addresseeId: b, status: "accepted" });
}
