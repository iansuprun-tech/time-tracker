<script setup lang="ts">
/**
 * Правка задачи отдельным окном. Раньше менять можно было только то, для чего
 * в строке блока нашлось место: статус, окно, факт. Название, проект, категория,
 * место и день правились единственным способом — удалить и завести заново.
 */
const props = defineProps<{ blockId: number }>();
const emit = defineEmits<{ close: []; saved: []; deleted: [] }>();

const { remember } = useTrash();

const { data: presets } = useFetch("/api/presets", { key: `presets-edit-${props.blockId}` });
const projectOptions = computed(() => (presets.value?.projects ?? []).map((p) => p.name));
const categoryOptions = computed(() => (presets.value?.categories ?? []).map((c) => c.name));
const placeOptions = computed(() => (presets.value?.places ?? []).map((p) => p.name));

const ICON = {
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  project: "M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.6a1 1 0 0 1-.8-.4l-1.2-1.6a1 1 0 0 0-.8-.4H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1z",
  place: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
};

const STATUSES = [
  { value: "todo", label: "к работе" },
  { value: "doing", label: "в работе" },
  { value: "done", label: "готово" },
  { value: "blocked", label: "блокер" },
  { value: "dropped", label: "отменено" },
];

const loaded = ref(false);
const failed = ref(false);
const saving = ref(false);
const removing = ref(false);
const confirmRemove = ref(false);
const error = ref("");

const title = ref("");
const project = ref("");
const category = ref("");
const location = ref("");
const status = ref("todo");
const kind = ref<"online" | "offline">("online");
const date = ref("");
const originalDate = ref("");
const startAt = ref("");
const endAt = ref("");
const durationText = ref("");
const timeOpen = ref(false);

const plannedMin = computed(() => {
  const n = Number(durationText.value.replace(/\D/g, ""));
  return n > 0 ? n : null;
});

const spanMin = computed(() => {
  const a = hhmmToMin(startAt.value);
  const b = hhmmToMin(endAt.value);
  return a !== null && b !== null && b > a ? b - a : null;
});

function hm(min: number) {
  if (min < 60) return `${min}м`;
  const rest = min % 60;
  return rest ? `${Math.floor(min / 60)}ч ${rest}м` : `${Math.floor(min / 60)}ч`;
}
const minutesLabel = (value: string) => hm(Number(value));
const spanLabel = computed(() => (spanMin.value ? hm(spanMin.value) : null));

async function load() {
  try {
    const d = await $fetch<{
      block: {
        title: string;
        date: string;
        project: string | null;
        category: string | null;
        location: string | null;
        status: string;
        kind: string;
        plannedMin: number | null;
        plannedStartMin: number | null;
        plannedEndMin: number | null;
      };
    }>("/api/block", { query: { id: props.blockId } });

    const b = d.block;
    title.value = b.title;
    project.value = b.project ?? "";
    category.value = b.category ?? "";
    location.value = b.location ?? "";
    status.value = b.status;
    kind.value = b.kind === "offline" ? "offline" : "online";
    date.value = b.date;
    originalDate.value = b.date;
    if (b.plannedStartMin != null && b.plannedEndMin != null) {
      startAt.value = minToHhmm(b.plannedStartMin);
      endAt.value = minToHhmm(b.plannedEndMin);
      timeOpen.value = true;
    } else if (b.plannedMin != null) {
      durationText.value = String(b.plannedMin);
    }
    loaded.value = true;
  } catch {
    failed.value = true;
  }
}
load();

function openTime() {
  timeOpen.value = true;
  if (!startAt.value && !endAt.value) {
    startAt.value = "10:00";
    endAt.value = "11:00";
  }
}

function clearTime() {
  startAt.value = "";
  endAt.value = "";
  timeOpen.value = false;
  // офлайн без окна не существует: снимая окно, возвращаем задачу в онлайн
  if (kind.value === "offline") kind.value = "online";
}

function pick(next: "online" | "offline") {
  kind.value = next;
  error.value = "";
  if (next === "offline") openTime();
}

async function save() {
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
    await $fetch<{ ok: boolean }>("/api/blocks/update", {
      method: "POST",
      body: {
        id: props.blockId,
        title: title.value.trim(),
        project: project.value,
        category: category.value,
        location: location.value,
        status: status.value,
        startMin,
        endMin,
        plannedMin: plannedMin.value,
        // день шлём только если он сменился: иначе перенос дёргает порядок зря
        ...(date.value !== originalDate.value ? { date: date.value } : {}),
      },
    });
    emit("saved");
    emit("close");
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? "Не сохранилось";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (removing.value) return;
  removing.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/blocks/delete", { method: "POST", body: { id: props.blockId } });
    remember(props.blockId, title.value.trim());
    emit("deleted");
    emit("close");
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? "Не удалилось";
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <ModalSheet wide submit-on-enter title="Правка задачи" @close="emit('close')" @enter="save">
    <p v-if="failed" class="py-6 text-center text-sm muted">Задача не открылась</p>

    <div v-else-if="!loaded" class="flex justify-center py-8">
      <Spinner />
    </div>

    <template v-else>
      <input
        v-model="title"
        placeholder="Название задачи…"
        class="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-black/30 dark:placeholder:text-white/25"
      />

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg bg-black/[0.05] p-0.5 text-xs dark:bg-white/10">
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

        <DateField v-model="date" :highlight="date !== originalDate" />

        <button v-if="!timeOpen" type="button" class="chip-empty" @click="openTime">
          <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="ICON.clock" />
          </svg>
          Время
        </button>

        <span v-else class="inline-flex items-center gap-2">
          <TimeField v-model="startAt" placeholder="с" />
          <span class="muted">—</span>
          <TimeField v-model="endAt" placeholder="по" :from-min="hhmmToMin(startAt)" />
          <span v-if="spanLabel" class="chip">{{ spanLabel }}</span>
          <button type="button" class="btn-quiet" @click="clearTime">убрать</button>
        </span>

        <PickerField
          v-if="!timeOpen"
          v-model="durationText"
          label="Длительность"
          add-label="минут"
          :icon="ICON.clock"
          :options="['15', '30', '45', '60', '90', '120']"
          :option-label="minutesLabel"
          numeric
        />

        <PickerField v-model="project" label="Проект" add-label="новый проект" :icon="ICON.project" :options="projectOptions" />
        <PickerField v-model="category" label="Категория" add-label="новая категория" :icon="ICON.tag" :options="categoryOptions" />
        <PickerField v-model="location" label="Место" add-label="новое место" :icon="ICON.place" :options="placeOptions" />
      </div>

      <div class="mt-4">
        <div class="mb-1.5 text-[11px] uppercase tracking-wide muted">Статус</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in STATUSES"
            :key="s.value"
            type="button"
            :class="status === s.value ? 'chip-set' : 'chip-attr'"
            @click="status = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="mt-5 border-t border-black/[0.06] pt-3 dark:border-white/10">
        <button
          v-if="!confirmRemove"
          type="button"
          class="btn-quiet text-red-600 dark:text-red-400"
          @click="confirmRemove = true"
        >
          Удалить задачу
        </button>
        <div v-else class="flex items-center gap-2 text-xs">
          <span class="muted">Удалить? Заметки и комментарии сохранятся в корзине.</span>
          <button type="button" :disabled="removing" class="btn-soft px-2 py-1 text-xs text-red-600 dark:text-red-400" @click="remove">
            <Spinner v-if="removing" />
            да
          </button>
          <button type="button" class="btn-quiet" @click="confirmRemove = false">нет</button>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        <p v-else-if="date !== originalDate" class="text-xs text-emerald-700 dark:text-emerald-400">
          переедет на {{ formatHuman(date, false) }}
        </p>
        <span v-else />
        <button :disabled="saving || !title.trim()" class="btn-primary shrink-0 px-4" title="Enter" @click="save">
          <Spinner v-if="saving" />
          Сохранить
        </button>
      </div>
    </template>
  </ModalSheet>
</template>
