<script setup lang="ts">
type Block = {
  id: number;
  title: string;
  category: string | null;
  location: string | null;
  plannedMin: number | null;
  actualMin: number | null;
  status: string;
  isUnplanned: boolean;
  trackedMin: number;
  runningSince: string | null;
  /** online — время натикает таймером, offline — вписано руками */
  kind: string;
  plannedStartMin: number | null;
  plannedEndMin: number | null;
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
  /** расчётное место блока в дне: у плавающего оно едет вместе с днём */
  slotPlan?: { startMin: number; endMin: number; fixed: boolean } | null;
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

const offline = computed(() => props.block.kind === "offline");
const hasWindow = computed(
  () => props.block.plannedStartMin != null && props.block.plannedEndMin != null,
);
const windowLabel = computed(() =>
  hasWindow.value
    ? `${minToHhmm(props.block.plannedStartMin!)}–${minToHhmm(props.block.plannedEndMin!)}`
    : null,
);
/** Плавающий блок своего времени не имеет — показываем, куда он встаёт по расчёту */
const driftLabel = computed(() =>
  !hasWindow.value && props.slotPlan
    ? `≈ ${minToHhmm(props.slotPlan.startMin)}–${minToHhmm(props.slotPlan.endMin)}`
    : null,
);
const windowOpen = ref(false);
const fromAt = ref("");
const toAt = ref("");

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

type BlockPatch = {
  status?: string;
  location?: string | null;
  actualMin?: number | null;
  title?: string;
  category?: string | null;
  startMin?: number | null;
  endMin?: number | null;
};

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

function openWindow() {
  fromAt.value = hasWindow.value ? minToHhmm(props.block.plannedStartMin!) : "";
  toAt.value = hasWindow.value ? minToHhmm(props.block.plannedEndMin!) : "";
  windowOpen.value = true;
}

async function saveWindow() {
  const start = hhmmToMin(fromAt.value);
  const end = hhmmToMin(toAt.value);
  // криво введённое время молча не сохраняем: поля остаются открытыми
  if (start === null || end === null || end <= start) return;
  await patch({ startMin: start, endMin: end });
  windowOpen.value = false;
}

async function clearWindow() {
  await patch({ startMin: null, endMin: null });
  windowOpen.value = false;
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
    class="card p-3 transition-colors"
    :class="[
      running ? 'bg-emerald-50/70 ring-1 ring-emerald-500/50 dark:bg-emerald-950/20' : '',
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
                class="chip"
              >
                {{ block.category }}
              </span>
              <span
                v-if="block.location"
                class="chip"
              >
                📍 {{ block.location }}
              </span>
              <span
                v-if="offline"
                class="chip"
              >
                офлайн
              </span>
              <span
                v-if="block.isUnplanned"
                class="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
              >
                вне плана
              </span>
              <span v-if="block.status === 'blocked'" class="text-[11px] text-red-600 dark:text-red-400">
                блокер
              </span>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
              <form v-if="windowOpen" class="flex items-center gap-1" @submit.prevent="saveWindow">
                <input
                  v-model="fromAt"
                  type="time"
                  step="300"
                  class="field px-2 py-0.5"
                />
                –
                <input
                  v-model="toAt"
                  type="time"
                  step="300"
                  class="field px-2 py-0.5"
                />
                <button :disabled="busy" class="btn-soft px-2 py-0.5 text-xs">
                  <Spinner v-if="busy" />
                  ок
                </button>
                <button
                  v-if="hasWindow"
                  type="button"
                  class="text-black/40 dark:text-white/40"
                  @click="clearWindow"
                >
                  убрать
                </button>
              </form>

              <button
                v-else-if="mode !== 'view'"
                class="underline decoration-dotted underline-offset-2"
                :title="hasWindow ? 'время фиксировано: блок не сдвинется' : 'задать фиксированное время'"
                @click="openWindow"
              >
                <template v-if="windowLabel">📌 {{ windowLabel }}</template>
                <template v-else>+время</template>
              </button>

              <span v-else-if="windowLabel">📌 {{ windowLabel }}</span>

              <span
                v-if="driftLabel"
                :title="'Расчётное время: блок идёт подряд и сдвинется вместе с днём'"
                class="text-black/40 dark:text-white/40"
              >
                {{ driftLabel }}
              </span>

              <span v-if="block.plannedMin != null && !hasWindow">план {{ block.plannedMin }}м</span>

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
                  class="field w-16 px-2 py-0.5"
                />
                <button :disabled="busy" class="btn-soft px-2 py-0.5 text-xs">
                  <Spinner v-if="busy" />
                  ок
                </button>
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
                :disabled="busy"
                class="field px-2 py-0.5 text-xs disabled:opacity-50"
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
              v-if="block.status !== 'done' && !offline"
              :disabled="busy"
              class="min-w-16 text-xs"
              :class="running ? 'btn-soft' : 'btn-primary'"
              @click="running ? stopTimer() : startTimer()"
            >
              <Spinner v-if="busy" />
              {{ running ? "Стоп" : "Старт" }}
            </button>
            <button
              :disabled="busy"
              class="btn-soft px-3 text-xs"
              @click="toggleDone"
            >
              <Spinner v-if="busy" />
              <template v-else>{{ block.status === "done" ? "↺" : "✓" }}</template>
            </button>
            <button
              class="btn-soft px-3 text-xs"
              @click="noteOpen = !noteOpen"
            >
              +заметка
            </button>
          </div>

          <button
            v-else-if="mode === 'plan'"
            :disabled="busy"
            class="btn-soft shrink-0 px-2 py-1 text-xs"
            @click="remove"
          >
            <Spinner v-if="busy" />
            <template v-else>✕</template>
          </button>

          <button
            v-else
            class="btn-soft shrink-0 px-2 py-1 text-xs"
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
            class="field flex-1 py-1 text-xs"
          />
          <button :disabled="busy" class="btn-soft px-2 py-1 text-xs">
            <Spinner v-if="busy" />
            ок
          </button>
        </form>
      </div>
    </div>
  </li>
</template>
