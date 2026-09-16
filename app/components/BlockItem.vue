<script setup lang="ts">
type Block = {
  id: number;
  title: string;
  category: string | null;
  project: string | null;
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
  /** день, которому принадлежит блок: у самого блока даты нет, она у дня */
  date: string;
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
const commentCount = computed(
  () => (props.comments ?? []).filter((c) => c.targetType === "block" && c.targetId === props.block.id).length,
);
/**
 * Заметки и комментарии живут под одним маркером: в списке видно, что по задаче
 * что-то сказано, а сам текст разворачивается по клику. Иначе длинный разговор
 * раздувает список и план перестаёт читаться с одного взгляда.
 */
const threadOpen = ref(false);
/** правка отдельным окном: в строке блока для названия и проекта места нет */
const editing = ref(false);
/** ✕ рядом с карандашом легко поймать пальцем мимо — спрашиваем */
const confirmRemove = ref(false);
/** редкие действия по блоку: в ряду кнопок им места нет, а выкидывать жалко */
const menuOpen = ref(false);
const { remember } = useTrash();

function closeMenu() {
  menuOpen.value = false;
  confirmRemove.value = false;
}

/** «Перенести на завтра» — то же, что сменить день в правке, но одним касанием */
async function moveToTomorrow() {
  const target = shiftDays(props.date, 1);
  await patch({ date: target });
  closeMenu();
}
const threadCount = computed(() => props.notes.length + commentCount.value);
/** читать нечего — открываем сразу на ввод, иначе не воруем фокус и клавиатуру */
const threadEmpty = computed(() => threadCount.value === 0);

const ICON = {
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
};

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
  date?: string;
  status?: string;
  location?: string | null;
  actualMin?: number | null;
  title?: string;
  category?: string | null;
  project?: string | null;
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
async function remove() {
  const title = props.block.title;
  const id = props.block.id;
  await call(() => $fetch<{ ok: boolean }>("/api/blocks/delete", { method: "POST", body: { id } }));
  closeMenu();
  // удаление мягкое: всплывашка внизу предлагает вернуть, пока не передумали
  remember(id, title);
}

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
  // панель не закрываем: только что написанное должно остаться на виду
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
              <span
                class="text-[15px] font-medium"
                :class="block.status === 'done' || block.status === 'dropped' ? 'line-through' : ''"
              >
                {{ block.title }}
              </span>
              <span
                v-if="block.project"
                class="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
              >
                {{ block.project }}
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

            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <form v-if="windowOpen" class="flex flex-wrap items-center gap-1.5" @submit.prevent="saveWindow">
                <TimeField v-model="fromAt" placeholder="с" />
                <span class="muted">—</span>
                <TimeField v-model="toAt" placeholder="по" :from-min="hhmmToMin(fromAt)" />
                <button :disabled="busy" class="btn-soft px-2 py-1 text-xs">
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
                type="button"
                :class="hasWindow ? 'chip-attr' : 'chip-empty'"
                :title="hasWindow ? 'Время фиксировано: блок не сдвинется' : 'Задать фиксированное время'"
                @click="openWindow"
              >
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                <template v-if="windowLabel">{{ windowLabel }}</template>
                <template v-else>Время</template>
              </button>

              <span v-else-if="windowLabel" class="chip-attr">
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                {{ windowLabel }}
              </span>

              <span
                v-if="driftLabel"
                class="chip-attr border-dashed text-black/45 dark:text-white/45"
                title="Расчётное время: блок идёт подряд и сдвинется вместе с днём"
              >
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                {{ driftLabel }}
              </span>

              <span v-if="block.plannedMin != null && !hasWindow" class="chip-attr">
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.calendar" />
                </svg>
                План {{ block.plannedMin }}м
              </span>

              <ElapsedTimer
                v-if="ticking"
                :since="block.runningSince!"
                :base-min="block.trackedMin"
                :planned-min="block.plannedMin"
                :chime="editable"
                :title="block.title"
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
                type="button"
                class="chip-attr"
                :class="over ? 'border-red-500/40 text-red-600 dark:text-red-400' : ''"
                title="Вписать фактическое время руками"
                @click="openFact"
              >
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                Факт {{ fact }}м<span v-if="block.actualMin != null">*</span>
              </button>

              <span v-else-if="fact > 0" class="chip-attr">
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                Факт {{ fact }}м
              </span>

              <!-- статус — тоже кнопка: нативный select без рамки читается как текст -->
              <span v-if="editable" class="relative inline-flex">
                <select
                  :value="block.status"
                  :disabled="busy"
                  class="chip-attr appearance-none pr-6 disabled:opacity-50"
                  @change="patch({ status: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  class="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1 self-start">
            <button
              v-if="editable && block.status !== 'done' && !offline"
              :disabled="busy"
              class="min-w-16 text-xs"
              :class="running ? 'btn-soft' : 'btn-primary'"
              @click="running ? stopTimer() : startTimer()"
            >
              <Spinner v-if="busy" />
              {{ running ? "Стоп" : "Старт" }}
            </button>

            <button
              v-if="editable"
              :disabled="busy"
              class="btn-soft px-3 text-xs"
              @click="toggleDone"
            >
              <Spinner v-if="busy" />
              <template v-else>{{ block.status === "done" ? "↺" : "✓" }}</template>
            </button>

            <button
              type="button"
              class="btn-soft px-2.5 py-1 text-xs"
              :class="
                threadCount
                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                  : 'text-black/40 dark:text-white/40'
              "
              :aria-expanded="threadOpen"
              :title="threadCount ? `Записей: ${threadCount}` : 'Написать заметку'"
              @click="threadOpen = !threadOpen"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.8A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
              </svg>
              <span v-if="threadCount" class="tabular-nums">{{ threadCount }}</span>
            </button>

            <button
              v-if="mode !== 'view'"
              type="button"
              class="btn-soft px-2.5 py-1 text-xs text-black/40 dark:text-white/40"
              aria-label="Править задачу"
              title="Править задачу"
              @click="editing = true"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>

            <button
              type="button"
              class="btn-soft px-2 py-1 text-xs text-black/40 dark:text-white/40"
              aria-label="Ещё действия"
              title="Ещё действия"
              @click="menuOpen = true"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="currentColor">
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
          </div>
        </div>

        <ModalSheet v-if="menuOpen" :title="block.title" @close="closeMenu">
          <ul class="-mx-1">
            <li v-if="mode !== 'view'">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
                @click="closeMenu(); editing = true"
              >
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                Править
              </button>
            </li>

            <li v-if="mode !== 'view'">
              <button
                type="button"
                :disabled="busy"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/10"
                @click="moveToTomorrow"
              >
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                Перенести на завтра
              </button>
            </li>

            <li v-if="mode !== 'view'" class="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/10">
              <button
                v-if="!confirmRemove"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                @click="confirmRemove = true"
              >
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                </svg>
                Удалить задачу
              </button>

              <div v-else class="px-3 py-2">
                <p class="text-xs muted">Заметки и комментарии сохранятся в корзине.</p>
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    :disabled="busy"
                    class="btn-soft px-3 py-1.5 text-xs text-red-600 dark:text-red-400"
                    @click="remove"
                  >
                    <Spinner v-if="busy" />
                    Удалить
                  </button>
                  <button type="button" class="btn-quiet" @click="confirmRemove = false">Отмена</button>
                </div>
              </div>
            </li>

            <li v-if="mode === 'view'">
              <p class="px-3 py-2 text-sm muted">Чужую задачу менять нельзя.</p>
            </li>
          </ul>
        </ModalSheet>

        <BlockEdit
          v-if="editing"
          :block-id="block.id"
          @close="editing = false"
          @saved="reload()"
          @deleted="reload()"
        />

        <div
          v-if="threadOpen"
          class="mt-3 space-y-2 border-t border-black/10 pt-3 dark:border-white/15"
        >
          <ul
            v-if="notes.length"
            class="space-y-1 border-l-2 border-black/10 pl-2 text-xs text-black/65 dark:border-white/15 dark:text-white/65"
          >
            <li v-for="n in notes" :key="n.id" class="whitespace-pre-wrap">{{ n.text }}</li>
          </ul>

          <form v-if="mode !== 'view'" class="flex gap-2" @submit.prevent="saveNote">
            <input
              v-model="noteText"
              :autofocus="threadEmpty"
              placeholder="что происходит по этому блоку"
              class="field flex-1 py-1 text-xs"
            />
            <button :disabled="busy" class="btn-soft px-2 py-1 text-xs">
              <Spinner v-if="busy" />
              ок
            </button>
          </form>

          <!-- свои комментарии друзей владелец иначе не увидит вовсе -->
          <div
            v-if="mode === 'view' || commentCount"
            :class="notes.length || mode !== 'view' ? 'border-t border-black/10 pt-2 dark:border-white/15' : ''"
          >
            <CommentThread
              target-type="block"
              :target-id="block.id"
              :comments="comments ?? []"
              compact
              @added="reload('comments')"
            />
          </div>
        </div>
      </div>
    </div>
  </li>
</template>
