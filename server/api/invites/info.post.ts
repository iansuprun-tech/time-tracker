import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { invites, users } from "../../utils/schema";
import { fail } from "../../utils/http";

/** Публично: страница приглашения должна открываться до входа */
export default defineEventHandler(async (event) => {
  const { token } = await readBody<{ token: string }>(event);

  const [row] = await db
    .select({
      inviterName: users.name,
      expiresAt: invites.expiresAt,
      usedById: invites.usedById,
    })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.inviterId))
    .where(eq(invites.token, token ?? ""));

  if (!row) throw fail(404, "Ссылка не найдена");

  return {
    inviterName: row.inviterName,
    used: row.usedById !== null,
    expired: row.expiresAt.getTime() < Date.now(),
  };
});
