<script setup lang="ts">
const props = defineProps<{ entryId: number; title: string; startedAt: string }>();
const emit = defineEmits<{ resolved: [] }>();

const minutes = ref(60);
const busy = ref(false);
const hours = computed(() => Math.round((Date.now() - new Date(props.startedAt).getTime()) / 3_600_000));

async function resolve() {
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/timer/resolve-stale", {
      method: "POST",
      body: { entryId: props.entryId, minutes: minutes.value },
    });
    emit("resolved");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm shadow-sm dark:bg-amber-950/20">
    <p class="mb-2">
      Таймер по «{{ title }}» идёт {{ hours }} ч — похоже, его забыли остановить. Сколько было на самом деле?
    </p>
    <form class="flex gap-2" @submit.prevent="resolve">
      <input
        v-model.number="minutes"
        type="number"
        min="0"
        step="5"
        class="field w-24 py-1"
      />
      <button
        :disabled="busy"
        class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1 font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
      >
        <Spinner v-if="busy" />
        минут
      </button>
    </form>
  </div>
</template>
