<script setup lang="ts">
const date = ref(tomorrowDate());
const { data, refresh } = await useFetch("/api/day", { query: { date } });

const blocks = computed(() => data.value?.blocks ?? []);
const plannedMin = computed(() => blocks.value.reduce((s, b) => s + (b.plannedMin ?? 0), 0));
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

    <ul class="space-y-2">
      <BlockItem v-for="b in blocks" :key="b.id" :block="b" :notes="[]" :editable="false" @changed="refresh" />
    </ul>

    <div class="mt-4">
      <AddBlock :date="date" hint="что делаем завтра" @added="refresh" />
    </div>
  </main>
</template>
