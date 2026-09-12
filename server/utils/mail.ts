import { fail } from "./http";

/**
 * Отправка письма через Resend: один HTTP-запрос, без библиотеки в зависимостях.
 * Нужны переменные RESEND_API_KEY и MAIL_FROM.
 *
 * Без ключа в проде письмо не уходит и ручка честно говорит об этом, а в разработке
 * письмо печатается в консоль — иначе сброс пароля нельзя проверить на своей машине.
 */
export async function sendMail(mail: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    if (import.meta.dev) {
      console.info(`\n=== письмо для ${mail.to} ===\n${mail.subject}\n${mail.text}\n`);
      return;
    }
    throw fail(500, "Почта не настроена: нет RESEND_API_KEY или MAIL_FROM");
  }

  await $fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: { from, to: mail.to, subject: mail.subject, text: mail.text },
  });
}
