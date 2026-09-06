<script setup lang="ts">
const date = ref(localDate());
const { data, refresh } = await useFetch("/api/day", { query: { date } });

const blocks = computed(() => data.value?.blocks ?? []);
const started = computed(() => data.value?.day.status !== "draft");
const startBusy = ref(false);

function notesFor(blockId: number) {
  return (data.value?.notes ?? []).filter((n) => n.blockId === blockId);
}

const doneCount = computed(() => blocks.value.filter((b) => b.status === "done").length);
const plannedMin = computed(() => blocks.value.reduce((s, b) => s + (b.plannedMin ?? 0), 0));
const factMin = computed(() => blocks.value.reduce((s, b) => s + (b.actualMin ?? b.trackedMin), 0));

async function startDay() {
  startBusy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/day/start", { method: "POST", body: { date: date.value } });
    await refresh();
  } finally {
    startBusy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-8">
    <header class="mb-6 flex items-baseline justify-between">
      <div>
        <h1 class="text-xl font-semibold">Сегодня</h1>
        <p class="text-sm text-black/50 dark:text-white/50">
          {{ date }}
          <template v-if="started">
            · {{ doneCount }}/{{ blocks.length }} · план {{ plannedMin }}м / факт {{ factMin }}м
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

    <div v-if="!started" class="mb-6 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <p class="mb-3 text-sm text-black/60 dark:text-white/60">
        {{
          blocks.length
            ? `План на сегодня: ${blocks.length} блоков. После старта он замораживается.`
            : "План пуст. Можно стартовать и добавлять по ходу, но тогда сравнивать будет не с чем."
        }}
      </p>
      <button
        :disabled="startBusy"
        class="w-full rounded bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        @click="startDay"
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

    <p v-if="!blocks.length && !started" class="py-6 text-center text-sm text-black/40 dark:text-white/40">
      Пусто. План пишется накануне — но можно и здесь.
    </p>

    <div class="mt-4">
      <AddBlock
        :date="date"
        :hint="started ? 'новая задача (пойдёт как вне плана)' : 'блок дня'"
        @added="refresh"
      />
    </div>
  </main>
</template>
