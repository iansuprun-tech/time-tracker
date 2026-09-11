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
  <form class="space-y-2" @submit.prevent="submit">
    <div class="flex flex-wrap gap-2">
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
        <option v-for="c in categoryOptions" :key="c" :value="c" />
      </datalist>
      <input
        v-model="location"
        list="known-places"
        placeholder="место"
        class="w-28 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
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
        class="w-20 rounded border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
      />
      <button
        :disabled="saving"
        class="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        <Spinner v-if="saving" />
        <template v-else>+</template>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <div class="inline-flex rounded border border-black/15 p-0.5 dark:border-white/20">
        <button
          v-for="k in (['online', 'offline'] as const)"
          :key="k"
          type="button"
          class="rounded px-2 py-1"
          :class="
            kind === k
              ? 'bg-black font-medium text-white dark:bg-white dark:text-black'
              : 'text-black/60 dark:text-white/60'
          "
          @click="pick(k)"
        >
          {{ k === "online" ? "онлайн" : "офлайн" }}
        </button>
      </div>

      <label class="flex items-center gap-1 text-black/55 dark:text-white/55">
        с
        <input
          v-model="startAt"
          type="time"
          step="300"
          class="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
        />
      </label>
      <label class="flex items-center gap-1 text-black/55 dark:text-white/55">
        по
        <input
          v-model="endAt"
          type="time"
          step="300"
          class="rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
        />
      </label>

      <span v-if="error" class="text-red-600 dark:text-red-400">{{ error }}</span>
      <span v-else class="text-black/40 dark:text-white/40">
        {{
          kind === "online"
            ? "время натикает таймером, окно — план"
            : "таймер не нужен: окно и есть факт"
        }}
      </span>
    </div>
  </form>
</template>
