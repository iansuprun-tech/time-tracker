import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { passwordResets, users } from "../../utils/schema";
import { findLiveReset } from "../../utils/reset";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string; password: string }>(event);
  const password = body.password ?? "";
  if (password.length < 8) throw fail(400, "Пароль короче 8 символов");

  const reset = await findLiveReset(String(body.token ?? ""));
  if (!reset) throw fail(400, "Ссылка не работает: она одноразовая и живёт час");

  const [user] = await db.select().from(users).where(eq(users.id, reset.userId));
  if (!user) throw fail(404, "Пользователь не найден");

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  // все остальные ссылки этого человека тоже гасим: пароль уже сменился
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.userId, user.id));

  const profile = { id: user.id, name: user.name, email: user.email };
  await setUserSession(event, { user: profile });
  return profile;
});
