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

const { items: ordered, draggingId, start: grab } = useDragSort(() => blocks.value, saveOrder);

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
  <main class="mx-auto max-w-2xl px-4 py-8">
    <header class="mb-6 flex items-baseline justify-between">
      <div>
        <h1 class="text-xl font-semibold">План на завтра</h1>
        <p class="text-sm text-black/50 dark:text-white/50">
          {{ date }} · {{ blocks.length }} блоков · {{ plannedMin }}м
        </p>
      </div>
      <NuxtLink to="/" class="text-sm underline underline-offset-4">← Сегодня</NuxtLink>
    </header>

    <button
      v-if="canCopy"
      :disabled="copying"
      class="mb-4 w-full rounded border border-dashed border-black/20 px-4 py-3 text-sm text-black/60 disabled:opacity-50 dark:border-white/25 dark:text-white/60"
      @click="copyFromToday"
    >
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
        @grab="grab(b.id, $event)"
      />
    </ul>

    <p v-if="!blocks.length && !canCopy" class="py-6 text-center text-sm text-black/40 dark:text-white/40">
      Завтра пока пусто.
    </p>

    <div class="mt-4">
      <AddBlock :date="date" hint="что делаем завтра" @added="refresh" />
    </div>
  </main>
</template>
