<script setup lang="ts">
const date = ref(localDate());
const { data, refresh } = await useFetch("/api/day", { query: { date } });

const blocks = computed(() => data.value?.blocks ?? []);
const status = computed(() => data.value?.day.status ?? "draft");
const started = computed(() => status.value === "started");
const finished = computed(() => status.value === "finished");
const busy = ref(false);

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

async function post(url: "/api/day/start" | "/api/day/reopen") {
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>(url, { method: "POST", body: { date: date.value } });
    await refresh();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <header class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">
          Сегодня
          <span v-if="finished" class="text-base font-normal text-black/40 dark:text-white/40">
            · закрыт {{ data?.day.mood ? MOOD_EMOJI[data.day.mood] : "" }}
          </span>
        </h1>
        <p class="text-sm text-black/50 dark:text-white/50">
          {{ date }}
          <template v-if="status !== 'draft'">
            · {{ doneCount }}/{{ blocks.length }} · план {{ plannedMin }}м / факт {{ factMin }}м
            <template v-if="unplannedMin > 0"> · вне плана {{ unplannedMin }}м</template>
          </template>
        </p>
      </div>
      <NuxtLink to="/tomorrow" class="text-sm underline underline-offset-4">План на завтра →</NuxtLink>
    </header>

    <div v-if="data?.stale" class="mb-4">
      <StaleTimerBanner
        :entry-id="data.stale.entryId"
        :title="data.stale.title"
        :started-at="data.stale.startedAt"
        @resolved="refresh"
      />
    </div>

    <div v-if="status === 'draft'" class="mb-6 rounded-lg border border-black/10 p-4 dark:border-white/15">
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
        v-for="b in blocks"
        :key="b.id"
        :block="b"
        :notes="notesFor(b.id)"
        :editable="started"
        @changed="refresh"
      />
    </ul>

    <p
      v-if="!blocks.length && status === 'draft'"
      class="py-6 text-center text-sm text-black/40 dark:text-white/40"
    >
      Пусто. План пишется накануне — но можно и здесь.
    </p>

    <div v-if="started" class="mt-4">
      <AddBlock :date="date" hint="новая задача (пойдёт как вне плана)" @added="refresh" />
    </div>
    <div v-else-if="status === 'draft'" class="mt-4">
      <AddBlock :date="date" hint="блок дня" @added="refresh" />
    </div>

    <div v-if="started" class="mt-8">
      <FinishDay
        :date="date"
        :mood="data?.day.mood ?? null"
        :day-note="data?.day.dayNote ?? null"
        @finished="refresh"
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

      <StandupSummary :date="date" />

      <button
        :disabled="busy"
        class="w-full rounded border border-black/15 px-4 py-2 text-sm text-black/60 disabled:opacity-50 dark:border-white/20 dark:text-white/60"
        @click="post('/api/day/reopen')"
      >
        Вернуться к работе
      </button>
    </div>
  </main>
</template>
