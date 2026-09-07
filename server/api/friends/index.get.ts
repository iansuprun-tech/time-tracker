import { and, eq, or } from "drizzle-orm";
import { db } from "../../utils/db";
import { friendships, users } from "../../utils/schema";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);

  const rows = await db
    .select({
      id: friendships.id,
      status: friendships.status,
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      requesterName: users.name,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));

  // имя собеседника зависит от того, с какой стороны смотрим
  const others = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  const nameOf = new Map(others.map((u) => [u.id, u]));

  const map = (r: (typeof rows)[number]) => {
    const otherId = r.requesterId === userId ? r.addresseeId : r.requesterId;
    const other = nameOf.get(otherId);
    return {
      id: r.id,
      userId: otherId,
      name: other?.name ?? "—",
      email: other?.email ?? "",
      incoming: r.addresseeId === userId,
    };
  };

  return {
    friends: rows.filter((r) => r.status === "accepted").map(map),
    incoming: rows.filter((r) => r.status === "pending" && r.addresseeId === userId).map(map),
    outgoing: rows.filter((r) => r.status === "pending" && r.requesterId === userId).map(map),
  };
});
