<script setup lang="ts">
const date = ref(tomorrowDate());
const today = ref(localDate());

const { data, refresh } = await useFetch("/api/day", { query: { date } });
const { data: todayData } = await useFetch("/api/day", { query: { date: today } });

const blocks = computed(() => data.value?.blocks ?? []);
const plannedMin = computed(() => blocks.value.reduce((s, b) => s + (b.plannedMin ?? 0), 0));

async function saveOrder(ids: number[]) {
  await $fetch<{ ok: boolean }>("/api/blocks/reorder", { method: "POST", body: { ids } });
  await refresh();
}

const { items: ordered, draggingId, start: grab, styleFor } = useDragSort(() => blocks.value, saveOrder);

// копировать есть что, только если сегодня был план и завтра ещё пусто
const canCopy = computed(
  () => blocks.value.length === 0 && (todayData.value?.blocks.length ?? 0) > 0,
);
const copying = ref(false);

async function copyFromToday() {
  copying.value = true;
  try {
    await $fetch<{ copied: number }>("/api/blocks/copy", {
      method: "POST",
      body: { fromDate: today.value, toDate: date.value },
    });
    await refresh();
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <main class="page">
    <header class="mb-6 flex items-baseline justify-between">
      <div>
        <h1 class="page-title">План на завтра</h1>
        <p class="mt-1 text-sm muted">
          {{ formatHuman(date) }} · {{ blocks.length }} блоков · {{ plannedMin }}м
        </p>
      </div>
      <NuxtLink to="/day" class="btn-soft">← Сегодня</NuxtLink>
    </header>

    <button
      v-if="canCopy"
      :disabled="copying"
      class="btn-soft mb-4 w-full border-dashed py-3"
      @click="copyFromToday"
    >
      <Spinner v-if="copying" />
      Скопировать план с сегодня ({{ todayData?.blocks.length }} блоков)
    </button>

    <ul class="space-y-2">
      <BlockItem
        v-for="b in ordered"
        :key="b.id"
        :block="b"
        :notes="[]"
        :mode="'plan'"
        :reload="async () => { await refresh(); }"
        :reorderable="blocks.length > 1"
        :dragging="draggingId === b.id"
        :style="styleFor(b.id)"
        @grab="grab(b.id, $event)"
      />
    </ul>

    <div v-if="!blocks.length" class="card card-pad py-10 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto size-7 text-black/20 dark:text-white/20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
      <p class="mt-2 text-sm font-medium">Завтра пока пусто</p>
      <p class="text-sm muted">План на завтра пишется сегодня — так утро начинается без раскачки.</p>
    </div>

    <section class="card card-pad mt-4">
      <h2 class="mb-3 text-sm font-medium">Добавить блок</h2>
      <AddBlock :date="date" hint="что делаем завтра" @added="refresh" />
    </section>
  </main>
</template>
