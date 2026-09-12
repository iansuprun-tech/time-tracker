<script setup lang="ts">
/** Неделя фактом: то же, что в дне, но разложенное по часам — свой календарь и чужой на просмотр */
const props = defineProps<{ ownerId?: number }>();
const { ownerId } = toRefs(props);

const route = useRoute();
const router = useRouter();

/** высота часа в пикселях: меньше — строки не читаются, больше — неделя не влезает в экран */
const HOUR_PX = 48;
const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// неделя живёт в адресе — как и дата дня: можно листать историю и делиться ссылкой
const from = computed(() => weekStart((route.query.from as string) || localDate()));

const query = computed(() => ({
  from: from.value,
  ...(props.ownerId ? { userId: String(props.ownerId) } : {}),
}));

const { data } = await useFetch("/api/week", { query });

const dates = computed(() => Array.from({ length: 7 }, (_, i) => shiftDays(from.value, i)));
const today = computed(() => localDate());

// идущий таймер рисуется до «сейчас», и красная черта едет вместе с ним
const now = ref(new Date());
let tick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  tick = setInterval(() => (now.value = new Date()), 30_000);
});
onBeforeUnmount(() => clearInterval(tick));

type Seg = {
  key: string;
  blockId: number;
  date: string;
  /** минуты от полуночи своего дня */
  from: number;
  to: number;
  title: string;
  category: string | null;
  location: string | null;
  status: string;
  isUnplanned: boolean;
  running: boolean;
  lane: number;
  lanes: number;
};

/** Интервал, перешедший за полночь, режется по суткам: колонка не умеет быть длиннее дня */
const pieces = computed(() => {
  const out: Omit<Seg, "lane" | "lanes">[] = [];
  for (const e of data.value?.entries ?? []) {
    const start = new Date(e.startedAt);
    const end = e.endedAt ? new Date(e.endedAt) : now.value;
    if (end.getTime() <= start.getTime()) continue;

    let cur = start;
    for (let guard = 0; cur.getTime() < end.getTime() && guard < 14; guard++) {
      const midnight = new Date(cur);
      midnight.setHours(24, 0, 0, 0);
      const stop = end.getTime() < midnight.getTime() ? end : midnight;
      const dayStart = new Date(cur);
      dayStart.setHours(0, 0, 0, 0);

      out.push({
        key: `${e.id}-${guard}`,
        blockId: e.blockId,
        date: localDate(cur),
        from: (cur.getTime() - dayStart.getTime()) / 60_000,
        to: (stop.getTime() - dayStart.getTime()) / 60_000,
        title: e.title,
        category: e.category,
        location: e.location,
        status: e.status,
        isUnplanned: e.isUnplanned,
        running: !e.endedAt && stop === end,
      });
      cur = stop;
    }
  }

  // офлайн-задача таймером не тикает: её окно и есть факт
  for (const b of data.value?.blocks ?? []) {
    if (b.kind !== "offline" || b.plannedStartMin == null || b.plannedEndMin == null) continue;
    out.push({
      key: `b${b.id}`,
      blockId: b.id,
      date: b.date,
      from: b.plannedStartMin,
      to: b.plannedEndMin,
      title: b.title,
      category: b.category,
      location: b.location,
      status: b.status,
      isUnplanned: b.isUnplanned,
      running: false,
    });
  }

  return out.filter((s) => dates.value.includes(s.date));
});

type PlanSlot = Slot & { title: string; location: string | null; date: string };

/**
 * План по часам: фиксированные задачи стоят в своём окне, плавающие идут подряд
 * от начала дня и обтекают их. Офлайн уже нарисован фактом, второй раз не рисуем.
 */
const plans = computed<PlanSlot[]>(() => {
  const all = data.value?.blocks ?? [];
  const out: PlanSlot[] = [];

  for (const date of dates.value) {
    const dayBlocks = all.filter((b) => b.date === date);
    if (!dayBlocks.length) continue;

    const startedAt = data.value?.days.find((d) => d.date === date)?.startedAt ?? null;
    const slots = scheduleDay(dayBlocks, startedAt ? minutesOfDay(startedAt) : undefined);

    for (const slot of slots) {
      const block = dayBlocks.find((b) => b.id === slot.id)!;
      if (block.kind === "offline") continue;
      out.push({ ...slot, date, title: block.title, location: block.location });
    }
  }

  return out;
});

/** Блок, которого нет ни в сетке, ни в факте: без окна, без длительности и без таймера */
const loose = computed(() => {
  const placed = new Set(plans.value.map((p) => p.id));
  return (data.value?.blocks ?? []).filter((b) => !b.tracked && !placed.has(b.id));
});

/** Рабочий день по умолчанию 8–20, но сетка растягивается под то, что в ней есть */
const bounds = computed(() => {
  let lo = 8 * 60;
  let hi = 20 * 60;
  for (const s of pieces.value) {
    lo = Math.min(lo, s.from);
    hi = Math.max(hi, s.to);
  }
  for (const p of plans.value) {
    lo = Math.min(lo, p.startMin);
    hi = Math.max(hi, p.endMin);
  }
  return { start: Math.max(0, Math.floor(lo / 60)), end: Math.min(24, Math.ceil(hi / 60)) };
});

const hours = computed(() =>
  Array.from({ length: bounds.value.end - bounds.value.start }, (_, i) => bounds.value.start + i),
);
const gridHeight = computed(() => (bounds.value.end - bounds.value.start) * HOUR_PX);

/**
 * Пересекающиеся интервалы делят ширину колонки. Одновременно идёт только один
 * таймер, но ручной факт и перенесённые блоки накладываться умеют.
 */
function layout(items: Omit<Seg, "lane" | "lanes">[]): Seg[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Seg[] = [];
  let cluster: Seg[] = [];
  let lanes: number[] = [];

  const flush = () => {
    for (const s of cluster) s.lanes = lanes.length;
    out.push(...cluster);
    cluster = [];
    lanes = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.from >= Math.max(...lanes)) flush();
    let lane = lanes.findIndex((end) => end <= item.from);
    if (lane === -1) lane = lanes.length;
    lanes[lane] = item.to;
    cluster.push({ ...item, lane, lanes: 1 });
  }
  flush();
  return out;
}

const columns = computed(() =>
  dates.value.map((date) => {
    const items = layout(pieces.value.filter((s) => s.date === date));
    return {
      date,
      items,
      plans: plans.value.filter((p) => p.date === date),
      loose: loose.value.filter((b) => b.date === date),
      minutes: items.reduce((sum, s) => sum + (s.to - s.from), 0),

      dayStatus: data.value?.days.find((d) => d.date === date)?.status ?? null,
    };
  }),
);

const weekMinutes = computed(() => columns.value.reduce((sum, c) => sum + c.minutes, 0));

function styleFor(s: Seg) {
  const width = 100 / s.lanes;
  return {
    top: `${((s.from - bounds.value.start * 60) / 60) * HOUR_PX}px`,
    height: `${Math.max(14, ((s.to - s.from) / 60) * HOUR_PX - 2)}px`,
    left: `calc(${s.lane * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
  };
}

function planStyle(p: Slot) {
  return {
    top: `${((p.startMin - bounds.value.start * 60) / 60) * HOUR_PX}px`,
    height: `${Math.max(14, ((p.endMin - p.startMin) / 60) * HOUR_PX - 2)}px`,
  };
}

/** Короткий блок не вмещает вторую строку — время уезжает в ту же, что и название */
function compact(s: Seg) {
  return (s.to - s.from) * (HOUR_PX / 60) < 34;
}

/** Место показываем только там, где под него есть третья строка */
function roomy(s: Seg) {
  return (s.to - s.from) * (HOUR_PX / 60) >= 52;
}

const PALETTE = [
  "bg-emerald-600 hover:bg-emerald-500",
  "bg-indigo-600 hover:bg-indigo-500",
  "bg-violet-600 hover:bg-violet-500",
  "bg-amber-600 hover:bg-amber-500",
  "bg-rose-600 hover:bg-rose-500",
  "bg-cyan-700 hover:bg-cyan-600",
  "bg-teal-600 hover:bg-teal-500",
  "bg-fuchsia-700 hover:bg-fuchsia-600",
];

/** Цвет держится за категорию, а без неё — за название: один и тот же блок красится одинаково всю неделю */
function colorOf(s: { category: string | null; title: string }) {
  const key = s.category ?? s.title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;
}

function hm(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m}м`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)}ч ${rest}м` : `${Math.floor(m / 60)}ч`;
}

function dayNum(date: string) {
  return Number(date.split("-")[2]);
}

const title = computed(() => {
  const [, m1] = from.value.split("-").map(Number);
  const last = dates.value[6]!;
  const [, m2] = last.split("-").map(Number);
  const left = m1 === m2 ? `${dayNum(from.value)}` : `${dayNum(from.value)} ${MONTHS[m1! - 1]}`;
  return `${left} — ${dayNum(last)} ${MONTHS[m2! - 1]}`;
});

/** Красная черта «сейчас» — только в сегодняшней колонке и только если попадает в сетку */
const nowTop = computed(() => {
  const min = now.value.getHours() * 60 + now.value.getMinutes();
  if (min < bounds.value.start * 60 || min > bounds.value.end * 60) return null;
  return ((min - bounds.value.start * 60) / 60) * HOUR_PX;
});

function shiftWeek(n: number) {
  router.push({ query: { ...route.query, from: shiftDays(from.value, n * 7) } });
}

function openDay(date: string) {
  const path = props.ownerId ? `/u-${props.ownerId}` : "/day";
  router.push({ path, query: { date } });
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-6 sm:py-8">
    <header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-xl font-semibold">
        {{ data?.readonly ? data?.owner?.name : "Моя неделя" }}
        <span class="text-base font-normal text-black/40 dark:text-white/40">
          · {{ weekMinutes ? hm(weekMinutes) : "пусто" }}
        </span>
      </h1>
      <div class="flex items-center gap-2 text-sm">
        <button class="px-2 text-black/50 dark:text-white/50" @click="shiftWeek(-1)">←</button>
        <span>{{ title }}</span>
        <button class="px-2 text-black/50 dark:text-white/50" @click="shiftWeek(1)">→</button>
        <button
          class="ml-2 rounded border border-black/15 px-2 py-1 text-xs text-black/60 dark:border-white/20 dark:text-white/60"
          @click="router.push({ query: { ...(ownerId ? { userId: String(ownerId) } : {}) } })"
        >
          Сегодня
        </button>
      </div>
    </header>

    <div class="overflow-x-auto">
      <div class="min-w-[760px]">
        <!-- шапка: числа недели -->
        <div class="grid" style="grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr))">
          <div />
          <button
            v-for="(c, i) in columns"
            :key="c.date"
            class="border-b border-black/10 pb-2 text-center dark:border-white/15"
            @click="openDay(c.date)"
          >
            <div class="text-[11px] tracking-wider text-black/40 dark:text-white/40">
              {{ WEEKDAYS[i] }}
            </div>
            <div
              class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-lg"
              :class="
                c.date === today
                  ? 'bg-emerald-600 font-medium text-white'
                  : 'text-black/80 dark:text-white/80'
              "
            >
              {{ dayNum(c.date) }}
            </div>
            <div class="h-4 text-[11px] text-black/40 dark:text-white/40">
              {{ c.minutes ? hm(c.minutes) : "" }}
            </div>
          </button>
        </div>

        <!-- сетка -->
        <div class="grid" style="grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr))">
          <!-- часы слева -->
          <div class="relative" :style="{ height: `${gridHeight}px` }">
            <div
              v-for="h in hours"
              :key="h"
              class="absolute right-2 -translate-y-1/2 text-[11px] text-black/40 dark:text-white/40"
              :style="{ top: `${(h - bounds.start) * HOUR_PX}px` }"
            >
              {{ h }}:00
            </div>
          </div>

          <div
            v-for="c in columns"
            :key="c.date"
            class="relative border-l border-black/10 dark:border-white/15"
            :style="{ height: `${gridHeight}px` }"
          >
            <!-- часовые линии -->
            <div
              v-for="h in hours"
              :key="h"
              class="pointer-events-none absolute inset-x-0 border-t border-black/[0.07] dark:border-white/10"
              :style="{ top: `${(h - bounds.start) * HOUR_PX}px` }"
            />

            <div
              v-if="c.date === today && nowTop !== null"
              class="pointer-events-none absolute inset-x-0 z-20 border-t border-red-500"
              :style="{ top: `${nowTop}px` }"
            >
              <span class="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-red-500" />
            </div>

            <div
              v-for="p in c.plans"
              :key="`p${p.id}`"
              class="pointer-events-none absolute inset-x-1 overflow-hidden rounded px-1.5 py-0.5 text-[11px] leading-tight"
              :class="
                p.fixed
                  ? 'border border-black/35 text-black/55 dark:border-white/40 dark:text-white/55'
                  : 'border border-dashed border-black/20 text-black/40 dark:border-white/25 dark:text-white/40'
              "
              :style="planStyle(p)"
              :title="`${p.title} · ${p.fixed ? 'фиксировано' : 'сдвинется'} ${minToHhmm(p.startMin)}–${minToHhmm(p.endMin)}`"
            >
              <span v-if="p.fixed">📌</span><span v-else>≈</span> {{ p.title }}
            </div>

            <button
              v-for="s in c.items"
              :key="s.key"
              class="absolute z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight text-white shadow-sm transition-colors"
              :class="[
                colorOf(s),
                s.status === 'dropped' ? 'opacity-50 line-through' : '',
                s.isUnplanned ? 'border-l-4 border-white/60' : '',
                s.running ? 'ring-2 ring-red-400' : '',
              ]"
              :style="styleFor(s)"
              :title="`${s.title} · ${hhmm(s.from)}–${hhmm(s.to)}${s.category ? ' · ' + s.category : ''}${s.location ? ' · ' + s.location : ''}`"
              @click="openDay(s.date)"
            >
              <template v-if="compact(s)">
                <span class="font-medium">{{ s.title }}</span
                >, {{ hhmm(s.from) }}
              </template>
              <template v-else>
                <div class="font-medium">{{ s.title }}</div>
                <div class="text-white/80">{{ hhmm(s.from) }} – {{ hhmm(s.to) }}</div>
                <div v-if="s.location && roomy(s)" class="truncate text-white/70">📍 {{ s.location }}</div>
              </template>
            </button>
          </div>
        </div>

        <!-- блоку без длительности и без окна в сетке места нет -->
        <div
          v-if="loose.length"
          class="mt-2 grid border-t border-black/10 pt-2 dark:border-white/15"
          style="grid-template-columns: 3.5rem repeat(7, minmax(0, 1fr))"
        >
          <div class="pr-2 text-right text-[11px] text-black/40 dark:text-white/40">без<br />времени</div>
          <div v-for="c in columns" :key="c.date" class="space-y-1 px-1">
            <button
              v-for="b in c.loose"
              :key="b.id"
              class="block w-full truncate rounded border border-dashed border-black/20 px-1.5 py-0.5 text-left text-[11px] text-black/50 dark:border-white/25 dark:text-white/50"
              :title="b.title"
              @click="openDay(c.date)"
            >
              {{ b.title }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!pieces.length" class="py-6 text-center text-sm text-black/40 dark:text-white/40">
      На этой неделе таймер не запускался.
    </p>
  </main>
</template>
