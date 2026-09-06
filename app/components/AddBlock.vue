<script setup lang="ts">
const props = defineProps<{ date: string; hint: string }>();
const emit = defineEmits<{ added: [] }>();

const title = ref("");
const plannedMin = ref<number | null>(null);
const saving = ref(false);

async function submit() {
  if (!title.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await $fetch("/api/blocks", {
      method: "POST",
      body: { date: props.date, title: title.value, plannedMin: plannedMin.value },
    });
    title.value = "";
    plannedMin.value = null;
    emit("added");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="flex gap-2" @submit.prevent="submit">
    <input
      v-model="title"
      :placeholder="hint"
      class="flex-1 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
    />
    <input
      v-model.number="plannedMin"
      type="number"
      min="0"
      step="5"
      placeholder="мин"
      class="w-20 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
    />
    <button
      :disabled="saving"
      class="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      +
    </button>
  </form>
</template>
