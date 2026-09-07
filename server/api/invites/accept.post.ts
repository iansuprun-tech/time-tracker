import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { invites } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { makeFriends } from "../../utils/friendship";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { token } = await readBody<{ token: string }>(event);

  const [invite] = await db.select().from(invites).where(eq(invites.token, token ?? ""));
  if (!invite) throw fail(404, "Ссылка не найдена");
  if (invite.expiresAt.getTime() < Date.now()) throw fail(410, "Срок ссылки истёк");
  if (invite.usedById !== null) throw fail(410, "Ссылкой уже воспользовались");
  if (invite.inviterId === userId) throw fail(400, "Это ваша собственная ссылка");

  await makeFriends(invite.inviterId, userId);
  await db
    .update(invites)
    .set({ usedById: userId, usedAt: new Date() })
    .where(eq(invites.id, invite.id));

  return { ok: true };
});
