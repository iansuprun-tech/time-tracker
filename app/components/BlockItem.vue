<script setup lang="ts">
type Block = {
  id: number;
  title: string;
  plannedMin: number | null;
  actualMin: number | null;
  status: string;
  isUnplanned: boolean;
  trackedMin: number;
  runningSince: string | null;
};

const props = defineProps<{
  block: Block;
  notes: { id: number; text: string }[];
  editable: boolean;
}>();
const emit = defineEmits<{ changed: [] }>();

const STATUS_LABEL: Record<string, string> = {
  todo: "к работе",
  doing: "в работе",
  done: "готово",
  blocked: "блокер",
  dropped: "отменено",
};

const noteOpen = ref(false);
const noteText = ref("");
const busy = ref(false);

const running = computed(() => Boolean(props.block.runningSince));
const fact = computed(() => props.block.actualMin ?? props.block.trackedMin);
const over = computed(
  () => props.block.plannedMin != null && props.block.plannedMin > 0 && fact.value > props.block.plannedMin * 1.2,
);

async function call(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
    emit("changed");
  } finally {
    busy.value = false;
  }
}

const startTimer = () =>
  call(() => $fetch("/api/timer/start", { method: "POST", body: { blockId: props.block.id } }));
const stopTimer = () => call(() => $fetch("/api/timer/stop", { method: "POST" }));
const toggleDone = () =>
  call(() =>
    $fetch(`/api/blocks/${props.block.id}`, {
      method: "PATCH",
      body: { status: props.block.status === "done" ? "todo" : "done" },
    }),
  );
const remove = () => call(() => $fetch(`/api/blocks/${props.block.id}`, { method: "DELETE" }));

async function saveNote() {
  if (!noteText.value.trim()) return;
  await call(() =>
    $fetch("/api/notes", { method: "POST", body: { blockId: props.block.id, text: noteText.value } }),
  );
  noteText.value = "";
  noteOpen.value = false;
}
</script>

<template>
  <li
    class="rounded-lg border p-3"
    :class="[
      running
        ? 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20'
        : 'border-black/10 dark:border-white/15',
      block.status === 'done' ? 'opacity-60' : '',
    ]"
  >
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span :class="block.status === 'done' ? 'line-through' : ''">{{ block.title }}</span>
          <span
            v-if="block.isUnplanned"
            class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
          >
            вне плана
          </span>
          <span
            v-if="block.status !== 'todo' && block.status !== 'doing'"
            class="text-[11px] text-black/50 dark:text-white/50"
          >
            {{ STATUS_LABEL[block.status] }}
          </span>
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
          <span v-if="block.plannedMin != null">план {{ block.plannedMin }}м</span>
          <ElapsedTimer v-if="running" :since="block.runningSince!" :base-min="block.trackedMin" />
          <span v-else-if="fact > 0" :class="over ? 'text-red-600 dark:text-red-400' : ''">
            факт {{ fact }}м
          </span>
        </div>

        <ul
          v-if="notes.length"
          class="mt-2 space-y-1 border-l-2 border-black/10 pl-2 text-xs text-black/65 dark:border-white/15 dark:text-white/65"
        >
          <li v-for="n in notes" :key="n.id">{{ n.text }}</li>
        </ul>
      </div>

      <div v-if="editable" class="flex shrink-0 items-center gap-1">
        <button
          v-if="block.status !== 'done'"
          :disabled="busy"
          class="rounded px-2 py-1 text-xs"
          :class="running ? 'border border-black/15 dark:border-white/20' : 'bg-emerald-600 text-white'"
          @click="running ? stopTimer() : startTimer()"
        >
          {{ running ? "Стоп" : "Старт" }}
        </button>
        <button
          :disabled="busy"
          class="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
          @click="toggleDone"
        >
          {{ block.status === "done" ? "↺" : "✓" }}
        </button>
        <button
          class="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
          @click="noteOpen = !noteOpen"
        >
          +заметка
        </button>
      </div>

      <button
        v-else
        :disabled="busy"
        class="shrink-0 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
        @click="remove"
      >
        ✕
      </button>
    </div>

    <form v-if="noteOpen" class="mt-2 flex gap-2" @submit.prevent="saveNote">
      <input
        v-model="noteText"
        autofocus
        placeholder="что происходит по этому блоку"
        class="flex-1 rounded border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
      />
      <button class="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20">ок</button>
    </form>
  </li>
</template>
