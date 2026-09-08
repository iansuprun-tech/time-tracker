<script setup lang="ts">
import { audioNow } from "~/composables/useChimes";

const props = defineProps<{
  since: string;
  baseMin: number;
  plannedMin?: number | null;
  /** звонить только на своём начатом дне: чужой таймер на просмотре молчит */
  chime?: boolean;
}>();

const { settings, chime, willChime, scheduleChime } = useSoundSettings();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => clearInterval(timer));

// сервер отдаёт точку отсчёта, клиент только рисует —
// иначе после сна ноутбука накапливается расхождение
const elapsedSec = computed(() => {
  const sec = Math.max(0, Math.floor((now.value - new Date(props.since).getTime()) / 1000));
  return props.baseMin * 60 + sec;
});

const label = computed(() => {
  const total = elapsedSec.value;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
});

/** Насколько вперёд кладём звуки в аудиопоток. Шире худшего тика фоновой вкладки (минута). */
const LOOKAHEAD_SEC = 150;
/** Расхождение аудиочасов с настенными, после которого считаем, что звук проспал */
const DRIFT_SEC = 2;

/** at — сколько секунд по блоку натикает к моменту вехи */
type Mark = { key: string; at: number };

const plannedSec = computed(() =>
  props.plannedMin && props.plannedMin > 0 ? props.plannedMin * 60 : 0,
);

/** Вехи в промежутке (from, to] — левый край открыт, чтобы одна веха не сработала дважды */
function marksIn(from: number, to: number): Mark[] {
  const s = settings.value;
  const out: Mark[] = [];

  const lastHour = Math.floor(to / 3600);
  for (let h = Math.max(1, Math.floor(from / 3600) + 1); h <= lastHour; h++) {
    if (!s.hourRepeat && h > 1) break;
    out.push({ key: `hour:${h}`, at: h * 3600 });
  }

  const planned = plannedSec.value;
  if (planned) {
    const approach = planned - s.approachMin * 60;
    if (approach > 0 && approach > from && approach <= to) out.push({ key: "approach", at: approach });
    if (planned > from && planned <= to) out.push({ key: "planned", at: planned });

    const every = s.overtimeEveryMin * 60;
    const lastOver = Math.floor((to - planned) / every);
    for (let k = Math.max(1, Math.floor((from - planned) / every) + 1); k <= lastOver; k++) {
      out.push({ key: `overtime:${k}`, at: planned + k * every });
    }
  }

  // при плане 120 «круглый час» и «план выбран» приходятся на одну секунду
  // и звучали бы кашей: из совпавших остаётся старшая, порядок задан выше
  const uniq: Mark[] = [];
  for (const m of out.sort((a, b) => a.at - b.at)) {
    if (uniq.at(-1)?.at === m.at) uniq.pop();
    uniq.push(m);
  }
  return uniq;
}

const eventOf = (key: string) => key.split(":")[0] as ChimeEvent;

/** ctxAt — время по часам аудиоконтекста, по нему же ловится расхождение */
const pending = new Map<string, { ctxAt: number; cancel: () => void }>();

function cancelPending() {
  for (const p of pending.values()) p.cancel();
  pending.clear();
}
onUnmounted(cancelPending);

// настройки и план могли поменяться на лету — запланированное протухло, соберём заново
watch([settings, plannedSec], cancelPending, { deep: true });

// вехи, пройденные до открытия страницы, не должны выстрелить задним числом
let prev = -1;
onMounted(() => (prev = elapsedSec.value));

watch(elapsedSec, (cur) => {
  const before = prev;
  prev = cur;
  if (!props.chime) return;

  const ctxNow = audioNow();

  // просроченное: фоновая вкладка тикает раз в минуту, а спящий ноутбук не тикает вовсе
  if (before >= 0) {
    const overdue = marksIn(before, cur).filter((m) => {
      const p = pending.get(m.key);
      if (!p) return willChime(eventOf(m.key));
      pending.delete(m.key);
      // аудиочасы не отстали — звук уже отзвучал вовремя, повторять нечего
      if (ctxNow === null || ctxNow >= p.ctxAt - DRIFT_SEC) return false;
      p.cancel();
      return true;
    });
    // за один тик может пересечься несколько порогов; звучит только старший
    const last = overdue.at(-1);
    if (last) chime(eventOf(last.key));
  }

  // будущее кладём в аудиопоток заранее: он не тротлится и сыграет секунда в секунду,
  // даже когда браузер душит фоновую вкладку
  if (ctxNow === null) return;
  for (const m of marksIn(cur, cur + LOOKAHEAD_SEC)) {
    if (pending.has(m.key)) continue;
    const ctxAt = ctxNow + (m.at - cur);
    const cancel = scheduleChime(eventOf(m.key), ctxAt);
    if (cancel) pending.set(m.key, { ctxAt, cancel });
  }
});
</script>

<template>
  <span class="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{{ label }}</span>
</template>
