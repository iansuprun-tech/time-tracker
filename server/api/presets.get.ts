import { requireUserId } from "../utils/session";
import { listPresets } from "../utils/presets";

/** Шаблоны мест и категорий — для подсказок в формах и для страницы настроек */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  return listPresets(userId);
});
