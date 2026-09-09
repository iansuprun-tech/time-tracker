<script setup lang="ts">
type Block = {
  id: number;
  title: string;
  category: string | null;
  plannedMin: number | null;
  actualMin: number | null;
  status: string;
  isUnplanned: boolean;
  trackedMin: number;
  runningSince: string | null;
};

type Comment = {
  id: number;
  targetType: string;
  targetId: number;
  text: string;
  authorId: number;
  authorName: string;
  createdAt: string;
};

const props = defineProps<{
  block: Block;
  notes: { id: number; text: string }[];
  /** edit — свой начатый день, plan — черновик плана, view — чужой день */
  mode: "edit" | "plan" | "view";
  comments?: Comment[];
  /** обновление данных дня; ждём его, иначе кнопка оживает раньше, чем приедет ответ */
  reload: (part?: "day" | "comments") => Promise<void>;
  /** блок можно тащить за ручку, меняя порядок в списке */
  reorderable?: boolean;
  /** этот блок сейчас едет под рукой */
  dragging?: boolean;
}>();

const emit = defineEmits<{ grab: [event: PointerEvent] }>();

const editable = computed(() => props.mode === "edit");
const commentsOpen = ref(false);
const commentCount = computed(
  () => (props.comments ?? []).filter((c) => c.targetType === "block" && c.targetId === props.block.id).length,
);

const STATUSES = [
  { value: "todo", label: "к работе" },
  { value: "doing", label: "в работе" },
  { value: "done", label: "готово" },
  { value: "blocked", label: "блокер" },
  { value: "dropped", label: "отменено" },
];

const noteOpen = ref(false);
const noteText = ref("");
const factOpen = ref(false);
const factValue = ref(0);
const busy = ref(false);

const { chime, unlock } = useSoundSettings();

// пока запрос в пути, кнопка показывает желаемое состояние: до базы далеко,
// и без этого клик выглядит непрошедшим
const pendingRunning = ref<boolean | null>(null);
const running = computed(() => pendingRunning.value ?? Boolean(props.block.runningSince));
/** настоящее состояние: часам нужна точка отсчёта с сервера, желаемого им мало */
const ticking = computed(() => Boolean(props.block.runningSince));
const fact = computed(() => props.block.actualMin ?? props.block.trackedMin);
const over = computed(
  () =>
    props.block.plannedMin != null &&
    props.block.plannedMin > 0 &&
    fact.value > props.block.plannedMin * 1.2,
);

async function call(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
    await props.reload();
  } finally {
    busy.value = false;
    pendingRunning.value = null;
  }
}

type BlockPatch = { status?: string; actualMin?: number | null; title?: string; category?: string | null };

const patch = (body: BlockPatch) =>
  call(() =>
    $fetch<{ ok: boolean }>("/api/blocks/update", {
      method: "POST",
      body: { id: props.block.id, ...body },
    }),
  );

function startTimer() {
  if (busy.value) return;
  // клик — единственный момент, когда браузер разрешает открыть звук;
  // после него вехи таймера звучат уже без участия пользователя
  unlock();
  chime("start");
  pendingRunning.value = true;
  return call(() =>
    $fetch<{ ok: boolean }>("/api/timer/start", { method: "POST", body: { blockId: props.block.id } }),
  );
}

function stopTimer() {
  if (busy.value) return;
  pendingRunning.value = false;
  return call(() => $fetch<{ ok: boolean }>("/api/timer/stop", { method: "POST" }));
}
const toggleDone = () => patch({ status: props.block.status === "done" ? "todo" : "done" });
const remove = () =>
  call(() => $fetch<{ ok: boolean }>("/api/blocks/delete", { method: "POST", body: { id: props.block.id } }));

function openFact() {
  factValue.value = fact.value;
  factOpen.value = true;
}

async function saveFact() {
  // null возвращает блок к автоподсчёту по интервалам таймера
  await patch({ actualMin: factValue.value >= 0 ? factValue.value : null });
  factOpen.value = false;
}

async function resetFact() {
  await patch({ actualMin: null });
  factOpen.value = false;
}

async function saveNote() {
  if (!noteText.value.trim()) return;
  await call(() =>
    $fetch<{ ok: boolean }>("/api/notes", { method: "POST", body: { blockId: props.block.id, text: noteText.value } }),
  );
  noteText.value = "";
  noteOpen.value = false;
}
</script>

<template>
  <li
    :data-block-id="block.id"
    class="rounded-lg border p-3"
    :class="[
      running
        ? 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20'
        : 'border-black/10 dark:border-white/15',
      block.status === 'done' || block.status === 'dropped' ? 'opacity-60' : '',
      dragging ? 'opacity-70 ring-2 ring-emerald-500/50' : '',
    ]"
  >
    <div class="flex items-start gap-2">
      <button
        v-if="reorderable"
        type="button"
        aria-label="Перетащить блок"
        class="-ml-1 shrink-0 cursor-grab touch-none select-none px-1 py-0.5 text-black/25 hover:text-black/50 active:cursor-grabbing dark:text-white/25 dark:hover:text-white/50"
        @pointerdown="emit('grab', $event)"
      >
        ⠿
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span :class="block.status === 'done' || block.status === 'dropped' ? 'line-through' : ''">
                {{ block.title }}
              </span>
              <span
                v-if="block.category"
                class="rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-black/60 dark:bg-white/10 dark:text-white/60"
              >
                {{ block.category }}
              </span>
              <span
                v-if="block.isUnplanned"
                class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
              >
                вне плана
              </span>
              <span v-if="block.status === 'blocked'" class="text-[11px] text-red-600 dark:text-red-400">
                блокер
              </span>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
              <span v-if="block.plannedMin != null">план {{ block.plannedMin }}м</span>

              <ElapsedTimer
                v-if="ticking"
                :since="block.runningSince!"
                :base-min="block.trackedMin"
                :planned-min="block.plannedMin"
                :chime="editable"
              />

              <form v-else-if="factOpen" class="flex items-center gap-1" @submit.prevent="saveFact">
                <input
                  v-model.number="factValue"
                  type="number"
                  min="0"
                  step="5"
                  autofocus
                  class="w-16 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
                />
                <button class="rounded border border-black/15 px-1.5 py-0.5 dark:border-white/20">ок</button>
                <button
                  v-if="block.actualMin != null"
                  type="button"
                  class="text-black/40 dark:text-white/40"
                  @click="resetFact"
                >
                  сброс
                </button>
              </form>

              <button
                v-else-if="editable"
                class="underline decoration-dotted underline-offset-2"
                :class="over ? 'text-red-600 dark:text-red-400' : ''"
                @click="openFact"
              >
                факт {{ fact }}м<span v-if="block.actualMin != null">*</span>
              </button>

              <span v-else-if="fact > 0">факт {{ fact }}м</span>

              <select
                v-if="editable"
                :value="block.status"
                class="rounded border border-black/10 bg-transparent px-1 py-0.5 dark:border-white/15"
                @change="patch({ status: ($event.target as HTMLSelectElement).value })"
              >
                <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>

            <ul
              v-if="notes.length"
              class="mt-2 space-y-1 border-l-2 border-black/10 pl-2 text-xs text-black/65 dark:border-white/15 dark:text-white/65"
            >
              <li v-for="n in notes" :key="n.id">{{ n.text }}</li>
            </ul>
          </div>

          <div v-if="editable" class="flex shrink-0 items-center gap-1 self-start">
            <button
              v-if="block.status !== 'done'"
              :disabled="busy"
              class="min-w-14 rounded px-2 py-2 text-xs sm:py-1"
              :class="running ? 'border border-black/15 dark:border-white/20' : 'bg-emerald-600 text-white'"
              @click="running ? stopTimer() : startTimer()"
            >
              {{ running ? "Стоп" : "Старт" }}
            </button>
            <button
              :disabled="busy"
              class="rounded border border-black/15 px-3 py-2 text-xs dark:border-white/20 sm:px-2 sm:py-1"
              @click="toggleDone"
            >
              {{ block.status === "done" ? "↺" : "✓" }}
            </button>
            <button
              class="rounded border border-black/15 px-3 py-2 text-xs dark:border-white/20 sm:px-2 sm:py-1"
              @click="noteOpen = !noteOpen"
            >
              +заметка
            </button>
          </div>

          <button
            v-else-if="mode === 'plan'"
            :disabled="busy"
            class="shrink-0 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
            @click="remove"
          >
            ✕
          </button>

          <button
            v-else
            class="shrink-0 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
            @click="commentsOpen = !commentsOpen"
          >
            💬<span v-if="commentCount"> {{ commentCount }}</span>
          </button>
        </div>

        <div v-if="mode === 'view' && commentsOpen" class="mt-3 border-t border-black/10 pt-3 dark:border-white/15">
          <CommentThread
            target-type="block"
            :target-id="block.id"
            :comments="comments ?? []"
            compact
            @added="reload('comments')"
          />
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
      </div>
    </div>
  </li>
</template>
