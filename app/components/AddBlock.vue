<script setup lang="ts">
const props = defineProps<{ date: string; hint: string }>();
const emit = defineEmits<{ added: [] }>();

const { data: knownCategories } = await useFetch("/api/categories");
const { data: presets } = await useFetch("/api/presets");

// в подсказках и шаблоны, и всё, что уже встречалось в блоках
const categoryOptions = computed(() => [
  ...new Set([...(presets.value?.categories ?? []).map((c) => c.name), ...(knownCategories.value ?? [])]),
]);
const placeOptions = computed(() => (presets.value?.places ?? []).map((p) => p.name));

const title = ref("");
const plannedMin = ref<number | null>(null);
const category = ref("");
const location = ref("");
/** online — время натикает таймером, offline — вписывается руками и таймер не нужен */
const kind = ref<"online" | "offline">("online");
const startAt = ref("");
const endAt = ref("");
const error = ref("");
const saving = ref(false);

/** Ближайшая четверть часа: офлайн-задачу вписывают про «только что», а не с нуля */
function suggestWindow() {
  const now = new Date();
  const start =
    props.date === localDate()
      ? Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15
      : 10 * 60;
  startAt.value = minToHhmm(start);
  endAt.value = minToHhmm(Math.min(start + 60, 1440));
}

function pick(next: "online" | "offline") {
  kind.value = next;
  error.value = "";
  if (next === "offline" && !startAt.value && !endAt.value) suggestWindow();
}

/** Время указано — задача стоит колом; нет — плывёт вместе с днём */
const hint2 = computed(() => {
  if (!startAt.value || !endAt.value) {
    return "без времени задача встанет подряд от начала дня и сдвинется вместе с ним";
  }
  return kind.value === "online"
    ? "время фиксировано: блок не сдвинется, факт натикает таймером"
    : "время фиксировано: таймер не нужен, окно и есть факт";
});

async function submit() {
  if (!title.value.trim() || saving.value) return;

  const startMin = hhmmToMin(startAt.value);
  const endMin = hhmmToMin(endAt.value);
  error.value = "";
  if (kind.value === "offline" && (startMin === null || endMin === null)) {
    error.value = "У офлайн-задачи нужно время с и по";
    return;
  }
  if ((startMin === null) !== (endMin === null)) {
    error.value = "Нужно и начало, и конец";
    return;
  }
  if (startMin !== null && endMin !== null && endMin <= startMin) {
    error.value = "Конец раньше начала";
    return;
  }

  saving.value = true;
  try {
    await $fetch<{ id: number }>("/api/blocks", {
      method: "POST",
      body: {
        date: props.date,
        title: title.value,
        plannedMin: plannedMin.value,
        category: category.value,
        location: location.value,
        kind: kind.value,
        startMin,
        endMin,
      },
    });
    title.value = "";
    plannedMin.value = null;
    // следующий блок обычно начинается там, где кончился прошлый
    if (endMin !== null) {
      startAt.value = minToHhmm(endMin);
      endAt.value = minToHhmm(Math.min(endMin + 60, 1440));
    }
    // категорию оставляем — подряд обычно заводят блоки одного типа
    emit("added");
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? "Не сохранилось";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div class="flex flex-wrap gap-2">
      <input v-model="title" :placeholder="hint" class="field min-w-44 flex-1" />
      <input
        v-model="category"
        list="known-categories"
        placeholder="категория"
        class="field w-32"
      />
      <datalist id="known-categories">
        <option v-for="c in categoryOptions" :key="c" :value="c" />
      </datalist>
      <input v-model="location" list="known-places" placeholder="место" class="field w-32" />
      <datalist id="known-places">
        <option v-for="pl in placeOptions" :key="pl" :value="pl" />
      </datalist>
      <input
        v-if="!startAt && !endAt"
        v-model.number="plannedMin"
        type="number"
        min="0"
        step="5"
        placeholder="мин"
        class="field w-20"
      />
      <button :disabled="saving" class="btn-primary w-10 px-0" aria-label="Добавить блок">
        <Spinner v-if="saving" />
        <template v-else>+</template>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <div class="inline-flex rounded-lg bg-black/[0.05] p-0.5 dark:bg-white/10">
        <button
          v-for="k in (['online', 'offline'] as const)"
          :key="k"
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors"
          :class="
            kind === k
              ? 'bg-white font-medium text-emerald-700 shadow-sm dark:bg-neutral-800 dark:text-emerald-400'
              : 'text-black/55 dark:text-white/55'
          "
          @click="pick(k)"
        >
          {{ k === "online" ? "Онлайн" : "Офлайн" }}
        </button>
      </div>

      <input v-model="startAt" type="time" step="300" class="field px-2 py-1" />
      <span class="muted">—</span>
      <input v-model="endAt" type="time" step="300" class="field px-2 py-1" />

      <button
        v-if="startAt || endAt"
        type="button"
        class="btn-quiet"
        @click="startAt = ''; endAt = ''"
      >
        убрать время
      </button>
    </div>

    <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else class="text-xs muted">{{ hint2 }}</p>
  </form>
</template>
