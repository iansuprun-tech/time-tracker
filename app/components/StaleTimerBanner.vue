<script setup lang="ts">
const props = defineProps<{ entryId: number; title: string; startedAt: string }>();
const emit = defineEmits<{ resolved: [] }>();

const minutes = ref(60);
const busy = ref(false);
const hours = computed(() => Math.round((Date.now() - new Date(props.startedAt).getTime()) / 3_600_000));

async function resolve() {
  busy.value = true;
  try {
    await $fetch("/api/timer/resolve-stale", {
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
  <div class="rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
    <p class="mb-2">
      Таймер по «{{ title }}» идёт {{ hours }} ч — похоже, его забыли остановить. Сколько было на самом деле?
    </p>
    <form class="flex gap-2" @submit.prevent="resolve">
      <input
        v-model.number="minutes"
        type="number"
        min="0"
        step="5"
        class="w-24 rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
      />
      <button :disabled="busy" class="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50">
        минут
      </button>
    </form>
  </div>
</template>
