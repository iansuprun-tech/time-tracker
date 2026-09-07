import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { users } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; email: string; password: string }>(event);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!name || !email) throw createError({ statusCode: 400, message: "Имя и почта обязательны" });
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: "Пароль короче 8 символов" });
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw createError({ statusCode: 409, message: "Такая почта уже зарегистрирована" });

  const [created] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id, name: users.name, email: users.email });

  await setUserSession(event, { user: created });
  return created;
});
