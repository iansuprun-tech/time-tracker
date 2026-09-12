import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { passwordResets, users } from "../../utils/schema";
import { newToken, sentRecently, RESET_TTL_MIN } from "../../utils/reset";
import { sendMail } from "../../utils/mail";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string }>(event);
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) throw fail(400, "Почта обязательна");

  const [user] = await db.select().from(users).where(eq(users.email, email));

  // ответ одинаков для любого адреса: иначе форма превращается в проверку,
  // кто здесь зарегистрирован
  if (!user || (await sentRecently(user.id))) return { ok: true };

  const { token, tokenHash } = newToken();
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000),
  });

  const link = `${getRequestURL(event).origin}/reset-${token}`;
  await sendMail({
    to: user.email,
    subject: "Трекер дня: восстановление пароля",
    text: [
      `Здравствуйте, ${user.name}.`,
      "",
      "Кто-то (надеемся, вы) просил сменить пароль. Ссылка живёт час и работает один раз:",
      link,
      "",
      "Если это были не вы — письмо можно выбросить, пароль останется прежним.",
    ].join("\n"),
  });

  return { ok: true };
});
