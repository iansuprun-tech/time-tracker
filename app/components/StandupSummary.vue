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
  <section class="card card-pad">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="font-medium">Сводка для стендапа</h2>
      <button
        class="btn-soft px-3 py-1 text-xs"
        @click="copy"
      >
        {{ copied ? "скопировано" : "копировать" }}
      </button>
    </div>
    <pre
      class="overflow-x-auto rounded-lg bg-black/[0.03] p-3 text-xs leading-relaxed whitespace-pre-wrap dark:bg-white/5"
      >{{ data?.text }}</pre
    >
  </section>
</template>
