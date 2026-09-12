import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { users } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { fail } from "../../utils/http";

/** Смена пароля для того, кто уже вошёл: старый пароль подтверждает, что это он */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{ current: string; next: string }>(event);
  const next = body.next ?? "";
  if (next.length < 8) throw fail(400, "Новый пароль короче 8 символов");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw fail(404, "Пользователь не найден");

  const ok = user.passwordHash ? await verifyPassword(user.passwordHash, body.current ?? "") : true;
  if (!ok) throw fail(403, "Текущий пароль не подходит");

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
  return { ok: true };
});
