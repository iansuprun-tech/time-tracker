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
const emit = defineEmits<{ close: []; changed: [] }>();

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

/** правка открывается поверх карточки: закрылась — перечитываем показанное */
const editing = ref(false);

async function afterEdit() {
  data.value = null;
  await load();
  emit("changed");
}
</script>

<template>
  <ModalSheet wide :title="whenLabel" @close="emit('close')">
    <p v-if="failed" class="py-6 text-center text-sm muted">Задача не открылась</p>

    <div v-else-if="!data" class="flex justify-center py-8">
      <Spinner />
    </div>

    <template v-else>
      <h2
        class="py-1 text-lg"
        :class="data.block.status === 'done' || data.block.status === 'dropped' ? 'line-through' : ''"
      >
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

    <template #footer>
      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="data"
          :to="{ path: dayPath, query: { date: data.block.date } }"
          class="btn-soft flex-1"
          @click="emit('close')"
        >
          Открыть день →
        </NuxtLink>
        <button v-if="data && !data.readonly" type="button" class="btn-primary px-4" @click="editing = true">
          Править
        </button>
      </div>
    </template>

    <BlockEdit
      v-if="editing"
      :block-id="blockId"
      @close="editing = false"
      @saved="afterEdit"
      @deleted="emit('changed'); emit('close')"
    />
  </ModalSheet>
</template>
