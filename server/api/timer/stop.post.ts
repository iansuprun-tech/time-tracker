import { stopRunning } from "../../utils/day";

export default defineEventHandler(async () => {
  await stopRunning();
  return { ok: true };
});
