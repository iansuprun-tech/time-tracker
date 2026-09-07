import type { H3Event } from "h3";

/** id текущего пользователя; 401, если сессии нет */
export async function requireUserId(event: H3Event) {
  const { user } = await requireUserSession(event);
  return Number((user as { id: number }).id);
}
