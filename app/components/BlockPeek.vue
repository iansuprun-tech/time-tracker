<script setup lang="ts">
/**
 * Задача, открытая из календаря: что это, когда, и весь разговор по ней.
 * В сетке у блока помещается только название и часы, а посмотреть хочется
 * заметки и комментарии — ради этого не должно приходиться уходить на день.
 */
const props = defineProps<{
  blockId: number;
  /** куда ведёт «открыть день»: свой день или чужой на просмотр */
  dayPath: string;
}>();
const emit = defineEmits<{ close: [] }>();

type Loaded = {
  block: {
    id: number;
    title: string;
    date: string;
    project: string | null;
    category: string | null;
    location: string | null;
    status: string;
    kind: string;
    isUnplanned: boolean;
    plannedMin: number | null;
    actualMin: number | null;
    plannedStartMin: number | null;
    plannedEndMin: number | null;
    trackedMin: number;
    runningSince: string | null;
  };
  readonly: boolean;
  notes: { id: number; text: string }[];
  comments: {
    id: number;
    targetType: string;
    targetId: number;
    text: string;
    authorId: number;
    authorName: string;
    createdAt: string;
  }[];
};

const data = ref<Loaded | null>(null);
const failed = ref(false);

async function load() {
  try {
    data.value = await $fetch<Loaded>("/api/block", { query: { id: props.blockId } });
  } catch {
    failed.value = true;
  }
}
load();

const STATUS_LABEL: Record<string, string> = {
  todo: "к работе",
  doing: "в работе",
  done: "готово",
  blocked: "блокер",
  dropped: "отменено",
};

/** «среда, 16 сентября · завтра» — день читается, а не вычисляется по колонке */
const whenLabel = computed(() => {
  const date = data.value?.block.date;
  if (!date) return "";
  const today = localDate();
  const rel =
    date === today ? "сегодня" : date === shiftDays(today, 1) ? "завтра" : date === shiftDays(today, -1) ? "вчера" : null;
  const human = `${formatHuman(date, date.slice(0, 4) !== today.slice(0, 4))}, ${weekdayShort(date).toLowerCase()}`;
  return rel ? `${human} · ${rel}` : human;
});

const windowLabel = computed(() => {
  const b = data.value?.block;
  if (!b || b.plannedStartMin == null || b.plannedEndMin == null) return null;
  return `${minToHhmm(b.plannedStartMin)}–${minToHhmm(b.plannedEndMin)}`;
});

const fact = computed(() => {
  const b = data.value?.block;
  if (!b) return 0;
  return b.actualMin ?? b.trackedMin;
});

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
onMounted(() => {
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

      <div
        class="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-neutral-900 sm:max-w-lg sm:rounded-2xl"
      >
        <div class="shrink-0 px-4 pt-3 sm:px-5">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" />
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs muted">{{ whenLabel }}</p>
            <button type="button" class="btn-quiet px-1.5" aria-label="Закрыть" @click="emit('close')">✕</button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
          <p v-if="failed" class="py-6 text-center text-sm muted">Задача не открылась</p>

          <div v-else-if="!data" class="flex justify-center py-8">
            <Spinner />
          </div>

          <template v-else>
            <h2 class="py-1 text-lg" :class="data.block.status === 'done' || data.block.status === 'dropped' ? 'line-through' : ''">
              {{ data.block.title }}
            </h2>

            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span
                v-if="data.block.project"
                class="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
              >
                {{ data.block.project }}
              </span>
              <span v-if="data.block.category" class="chip">{{ data.block.category }}</span>
              <span v-if="data.block.location" class="chip">📍 {{ data.block.location }}</span>
              <span v-if="data.block.kind === 'offline'" class="chip">офлайн</span>
              <span class="chip">{{ STATUS_LABEL[data.block.status] ?? data.block.status }}</span>
              <span
                v-if="data.block.isUnplanned"
                class="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
              >
                вне плана
              </span>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-3 text-xs muted">
              <span v-if="windowLabel">📌 {{ windowLabel }}</span>
              <span v-if="data.block.plannedMin != null">план {{ data.block.plannedMin }}м</span>
              <span v-if="fact > 0">факт {{ fact }}м</span>
              <span v-if="data.block.runningSince" class="text-red-600 dark:text-red-400">идёт сейчас</span>
            </div>

            <ul
              v-if="data.notes.length"
              class="mt-4 space-y-1 border-l-2 border-black/10 pl-2 text-xs text-black/65 dark:border-white/15 dark:text-white/65"
            >
              <li v-for="n in data.notes" :key="n.id" class="whitespace-pre-wrap">{{ n.text }}</li>
            </ul>

            <div class="mt-4 border-t border-black/10 pt-3 dark:border-white/15">
              <CommentThread
                target-type="block"
                :target-id="data.block.id"
                :comments="data.comments"
                compact
                @added="load"
              />
            </div>
          </template>
        </div>

        <div
          class="shrink-0 border-t border-black/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 sm:px-5"
        >
          <NuxtLink
            v-if="data"
            :to="{ path: dayPath, query: { date: data.block.date } }"
            class="btn-soft w-full"
            @click="emit('close')"
          >
            Открыть день →
          </NuxtLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>
