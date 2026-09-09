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

const { items: ordered, draggingId, start: grab } = useDragSort(() => blocks.value, saveOrder);

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
  <main class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h1 class="text-xl font-semibold">
          {{ readonly ? data?.owner?.name : "Мой день" }}
          <span v-if="finished" class="text-base font-normal text-black/40 dark:text-white/40">
            · закрыт {{ data?.day.mood ? MOOD_EMOJI[data.day.mood] : "" }}
          </span>
        </h1>
        <div class="flex items-center gap-2 text-sm">
          <button class="px-2 text-black/50 dark:text-white/50" @click="shift(-1)">←</button>
          <span>{{ date }}</span>
          <button class="px-2 text-black/50 dark:text-white/50" @click="shift(1)">→</button>
        </div>
      </div>

      <p class="text-sm text-black/50 dark:text-white/50">
        <template v-if="status !== 'draft'">
          {{ doneCount }}/{{ blocks.length }} · план {{ plannedMin }}м / факт {{ factMin }}м
          <template v-if="unplannedMin > 0"> · вне плана {{ unplannedMin }}м</template>
        </template>
        <template v-else>день не начат</template>
        <template v-if="!isToday"> · не сегодня</template>
      </p>
    </header>

    <div v-if="data?.stale" class="mb-4">
      <StaleTimerBanner
        :entry-id="data.stale.entryId"
        :title="data.stale.title"
        :started-at="data.stale.startedAt"
        @resolved="reload"
      />
    </div>

    <div
      v-if="!readonly && status === 'draft' && isToday"
      class="mb-6 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <p class="mb-3 text-sm text-black/60 dark:text-white/60">
        {{
          blocks.length
            ? `План на сегодня: ${blocks.length} блоков. После старта он замораживается.`
            : "План пуст. Можно стартовать и добавлять по ходу, но тогда сравнивать будет не с чем."
        }}
      </p>
      <button
        :disabled="busy"
        class="w-full rounded bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        @click="post('/api/day/start')"
      >
        Старт дня
      </button>
    </div>

    <ul class="space-y-2">
      <BlockItem
        v-for="b in ordered"
        :key="b.id"
        :block="b"
        :notes="notesFor(b.id)"
        :mode="blockMode"
        :comments="comments ?? []"
        :reload="reload"
        :reorderable="reorderable"
        :dragging="draggingId === b.id"
        @grab="grab(b.id, $event)"
      />
    </ul>

    <p v-if="!blocks.length" class="py-6 text-center text-sm text-black/40 dark:text-white/40">
      {{ readonly ? "В этот день блоков не было." : "Пусто. План пишется накануне — но можно и здесь." }}
    </p>

    <div v-if="!readonly && !finished" class="mt-4">
      <AddBlock
        :date="date"
        :hint="started ? 'новая задача (пойдёт как вне плана)' : 'блок дня'"
        @added="reload()"
      />
    </div>

    <div v-if="!readonly && started" class="mt-8">
      <FinishDay
        :date="date"
        :mood="data?.day.mood ?? null"
        :day-note="data?.day.dayNote ?? null"
        @finished="reload()"
      />
    </div>

    <div v-if="finished" class="mt-8 space-y-4">
      <section
        v-if="data?.day.dayNote"
        class="rounded-lg border border-black/10 p-4 text-sm dark:border-white/15"
      >
        <h2 class="mb-2 font-medium">Ощущения за день</h2>
        <p class="whitespace-pre-wrap text-black/70 dark:text-white/70">{{ data.day.dayNote }}</p>
      </section>

      <StandupSummary :date="date" :owner-id="ownerId" />

      <button
        v-if="!readonly"
        :disabled="busy"
        class="w-full rounded border border-black/15 px-4 py-2 text-sm text-black/60 disabled:opacity-50 dark:border-white/20 dark:text-white/60"
        @click="post('/api/day/reopen')"
      >
        Вернуться к работе
      </button>
    </div>

    <section v-if="data?.day.id" class="mt-8 rounded-lg border border-black/10 p-4 dark:border-white/15">
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
