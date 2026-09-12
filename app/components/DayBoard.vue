<script setup lang="ts">
/** Один и тот же экран дня: свой (ownerId не задан) и чужой на просмотр */
const props = defineProps<{ ownerId?: number }>();

const route = useRoute();
const router = useRouter();

// дата живёт в адресе: так можно листать историю и делиться ссылкой на конкретный день
const date = computed(() => (route.query.date as string) || localDate());
const isToday = computed(() => date.value === localDate());

const query = computed(() => ({
  date: date.value,
  ...(props.ownerId ? { userId: String(props.ownerId) } : {}),
}));

const { data, refresh } = await useFetch("/api/day", { query });

const blocks = computed(() => data.value?.blocks ?? []);
const readonly = computed(() => data.value?.readonly ?? false);
const status = computed(() => data.value?.day.status ?? "draft");
const started = computed(() => status.value === "started");
const finished = computed(() => status.value === "finished");
const busy = ref(false);

/** порядок блоков можно менять на своём дне — и в плане, и по ходу дня */
const reorderable = computed(() => !readonly.value && blocks.value.length > 1);

async function saveOrder(ids: number[]) {
  await $fetch<{ ok: boolean }>("/api/blocks/reorder", { method: "POST", body: { ids } });
  await refresh();
}

const { items: ordered, draggingId, start: grab, styleFor } = useDragSort(() => blocks.value, saveOrder);

/**
 * Расчётное время плавающих блоков: фиксированные стоят в своём окне,
 * остальные идут подряд от начала дня и обтекают их.
 */
const schedule = computed(() => {
  const startedAt = data.value?.day.startedAt ?? null;
  return scheduleDay(blocks.value, startedAt ? minutesOfDay(startedAt) : undefined);
});
const slotFor = (id: number) => schedule.value.find((s) => s.id === id) ?? null;

const blockMode = computed<"edit" | "plan" | "view">(() => {
  if (readonly.value) return "view";
  return started.value ? "edit" : "plan";
});

const commentQuery = computed(() => ({
  dayId: data.value?.day.id ?? 0,
  blockIds: blocks.value.map((b) => b.id).join(","),
}));
const { data: comments, refresh: refreshComments } = await useFetch("/api/comments", {
  query: commentQuery,
});

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function notesFor(blockId: number) {
  return (data.value?.notes ?? []).filter((n) => n.blockId === blockId);
}

const doneCount = computed(() => blocks.value.filter((b) => b.status === "done").length);
const plannedMin = computed(() => blocks.value.reduce((s, b) => s + (b.plannedMin ?? 0), 0));
const factMin = computed(() => blocks.value.reduce((s, b) => s + (b.actualMin ?? b.trackedMin), 0));
const unplannedMin = computed(() =>
  blocks.value.filter((b) => b.isUnplanned).reduce((s, b) => s + (b.actualMin ?? b.trackedMin), 0),
);

const goToday = () => router.push({ query: { ...route.query, date: localDate() } });

function shift(days: number) {
  const [y, m, d] = date.value.split("-").map(Number);
  const next = new Date(y!, m! - 1, d! + days);
  router.push({ query: { ...route.query, date: localDate(next) } });
}

async function post(url: "/api/day/start" | "/api/day/reopen") {
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>(url, { method: "POST", body: { date: date.value } });
    await refresh();
  } finally {
    busy.value = false;
  }
}

/**
 * Старт таймера комментарии не меняет, а лишний заход стоит целого round-trip
 * до базы — поэтому обновляем ровно то, что могло поехать.
 */
async function reload(part: "day" | "comments" = "day") {
  await (part === "comments" ? refreshComments() : refresh());
}
</script>

<template>
  <main class="page">
    <header class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title">
          {{ readonly ? data?.owner?.name : "Мой день" }}
          <span v-if="finished" class="text-base font-normal muted">
            · закрыт {{ data?.day.mood ? MOOD_EMOJI[data.day.mood] : "" }}
          </span>
        </h1>
        <div class="mt-1 flex items-center gap-1 text-sm muted">
          <span>{{ formatHuman(date) }}</span>
          <button class="btn-quiet px-1.5" aria-label="Предыдущий день" @click="shift(-1)">‹</button>
          <button class="btn-quiet px-1.5" aria-label="Следующий день" @click="shift(1)">›</button>
          <button v-if="!isToday" class="btn-quiet" @click="goToday">сегодня</button>
        </div>
      </div>

      <div v-if="status !== 'draft'" class="flex gap-4 text-sm">
        <div>
          <div class="text-[11px] uppercase tracking-wide muted">готово</div>
          <div class="font-medium tabular-nums">{{ doneCount }}/{{ blocks.length }}</div>
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wide muted">план</div>
          <div class="font-medium tabular-nums">{{ plannedMin }}м</div>
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wide muted">факт</div>
          <div class="font-medium tabular-nums">{{ factMin }}м</div>
        </div>
        <div v-if="unplannedMin > 0">
          <div class="text-[11px] uppercase tracking-wide muted">вне плана</div>
          <div class="font-medium tabular-nums text-amber-600 dark:text-amber-400">
            {{ unplannedMin }}м
          </div>
        </div>
      </div>
    </header>

    <div v-if="data?.stale" class="mb-4">
      <StaleTimerBanner
        :entry-id="data.stale.entryId"
        :title="data.stale.title"
        :started-at="data.stale.startedAt"
        @resolved="reload"
      />
    </div>

    <section
      v-if="!readonly && status === 'draft' && isToday"
      class="card card-pad mb-5 flex flex-wrap items-center gap-4"
    >
      <span
        class="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
      <div class="min-w-40 flex-1">
        <h2 class="font-medium">День не начат</h2>
        <p class="text-sm muted">
          {{
            blocks.length
              ? `План на сегодня: ${blocks.length} блоков. После старта он замораживается.`
              : "План пуст. Можно стартовать и добавлять по ходу, но тогда сравнивать будет не с чем."
          }}
        </p>
      </div>
      <button :disabled="busy" class="btn-primary px-4 py-2.5" @click="post('/api/day/start')">
        <Spinner v-if="busy" />
        Начать день
      </button>
    </section>

    <section v-if="!readonly && !finished" class="card card-pad mb-5">
      <h2 class="mb-3 text-sm font-medium">{{ started ? "Добавить задачу" : "План на день" }}</h2>
      <AddBlock
        :date="date"
        :hint="started ? 'новая задача (пойдёт как вне плана)' : 'название блока'"
        @added="reload()"
      />
    </section>

    <ul v-if="blocks.length" class="space-y-2">
      <BlockItem
        v-for="b in ordered"
        :key="b.id"
        :block="b"
        :notes="notesFor(b.id)"
        :slot-plan="slotFor(b.id)"
        :mode="blockMode"
        :comments="comments ?? []"
        :reload="reload"
        :reorderable="reorderable"
        :dragging="draggingId === b.id"
        :style="styleFor(b.id)"
        @grab="grab(b.id, $event)"
      />
    </ul>

    <div v-else class="card card-pad py-10 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto size-7 text-black/20 dark:text-white/20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
      </svg>
      <p class="mt-2 text-sm font-medium">План пуст</p>
      <p class="text-sm muted">
        {{ readonly ? "В этот день блоков не было." : "Добавьте первый блок, чтобы увидеть план на день." }}
      </p>
    </div>

    <div v-if="!readonly && started" class="mt-6">
      <FinishDay
        :date="date"
        :mood="data?.day.mood ?? null"
        :day-note="data?.day.dayNote ?? null"
        @finished="reload()"
      />
    </div>

    <div v-if="finished" class="mt-6 space-y-4">
      <section v-if="data?.day.dayNote" class="card card-pad text-sm">
        <h2 class="mb-2 font-medium">Ощущения за день</h2>
        <p class="whitespace-pre-wrap text-black/70 dark:text-white/70">{{ data.day.dayNote }}</p>
      </section>

      <StandupSummary :date="date" :owner-id="ownerId" />

      <button v-if="!readonly" :disabled="busy" class="btn-soft w-full" @click="post('/api/day/reopen')">
        <Spinner v-if="busy" />
        Вернуться к работе
      </button>
    </div>

    <section v-if="data?.day.id" class="card card-pad mt-6">
      <h2 class="mb-3 font-medium">Обсуждение дня</h2>
      <CommentThread
        target-type="day"
        :target-id="data.day.id"
        :comments="comments ?? []"
        @added="refreshComments"
      />
    </section>
  </main>
</template>
