<script setup lang="ts">
const props = defineProps<{ date: string; hint: string }>();
const emit = defineEmits<{ added: [] }>();

const { data: knownCategories } = await useFetch("/api/categories");

const title = ref("");
const plannedMin = ref<number | null>(null);
const category = ref("");
const saving = ref(false);

async function submit() {
  if (!title.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await $fetch<{ id: number }>("/api/blocks", {
      method: "POST",
      body: {
        date: props.date,
        title: title.value,
        plannedMin: plannedMin.value,
        category: category.value,
      },
    });
    title.value = "";
    plannedMin.value = null;
    // категорию оставляем — подряд обычно заводят блоки одного типа
    emit("added");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="flex flex-wrap gap-2" @submit.prevent="submit">
    <input
      v-model="title"
      :placeholder="hint"
      class="min-w-40 flex-1 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
    />
    <input
      v-model="category"
      list="known-categories"
      placeholder="категория"
      class="w-28 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
    />
    <datalist id="known-categories">
      <option v-for="c in knownCategories ?? []" :key="c" :value="c" />
    </datalist>
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
