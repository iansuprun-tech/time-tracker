import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { users } from "../../utils/schema";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string; password: string }>(event);
  const email = (body.email ?? "").trim().toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  // аккаунты, заведённые до появления входа, паролем не обладают
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, body.password ?? "") : false;
  if (!ok) throw fail(401, "Неверная почта или пароль");

  const profile = { id: user!.id, name: user!.name, email: user!.email };
  await setUserSession(event, { user: profile });
  return profile;
});
