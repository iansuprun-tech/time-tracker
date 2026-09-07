import { stopRunning } from "../../utils/day";
import { requireUserId } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  await stopRunning(userId);
  return { ok: true };
});
