/**
 * Ошибка с текстом, который доживёт до клиента.
 * В проде h3 подменяет message на «Server Error», а data — отдаёт как есть.
 */
export function fail(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message, data: { message } });
}
