<script setup lang="ts">
const props = defineProps<{ date: string; ownerId?: number }>();

const query = computed(() => ({
  date: props.date,
  ...(props.ownerId ? { userId: String(props.ownerId) } : {}),
}));
const { data } = await useFetch("/api/standup", { query });
const copied = ref(false);

async function copy() {
  if (!data.value?.text) return;
  try {
    await navigator.clipboard.writeText(data.value.text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // буфер недоступен (http без localhost, отказ в правах) — текст остаётся на экране
    copied.value = false;
  }
}
</script>

<template>
  <section class="rounded-lg border border-black/10 p-4 dark:border-white/15">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-medium">Сводка для стендапа</h2>
      <button
        class="rounded border border-black/15 px-3 py-1 text-xs dark:border-white/20"
        @click="copy"
      >
        {{ copied ? "скопировано" : "копировать" }}
      </button>
    </div>
    <pre
      class="overflow-x-auto rounded bg-black/[0.03] p-3 text-xs leading-relaxed whitespace-pre-wrap dark:bg-white/5"
      >{{ data?.text }}</pre
    >
  </section>
</template>
