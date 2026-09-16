<script setup lang="ts">
const props = defineProps<{
  date: string;
  /** подпись кнопки, открывающей шторку */
  label: string;
  /** день начат — всё заведённое в него пойдёт как внеплановое */
  dayStarted?: boolean;
}>();
const emit = defineEmits<{ added: [] }>();

const { data: knownCategories } = await useFetch("/api/categories");
const { data: presets, refresh: reloadPresets } = await useFetch("/api/presets");

// в подсказках и шаблоны, и всё, что уже встречалось в блоках
const categoryOptions = computed(() => [
  ...new Set([...(presets.value?.categories ?? []).map((c) => c.name), ...(knownCategories.value ?? [])]),
]);
const placeOptions = computed(() => (presets.value?.places ?? []).map((p) => p.name));
const projectOptions = computed(() => (presets.value?.projects ?? []).map((p) => p.name));

const ICON = {
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  project: "M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.6a1 1 0 0 1-.8-.4l-1.2-1.6a1 1 0 0 0-.8-.4H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1z",
  place: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
};

const open = ref(false);
const titleInput = ref<HTMLInputElement | null>(null);

const title = ref("");
const description = ref("");
/**
 * День, в который уйдёт блок. Обычно открытый, но задача редко приходит в голову
 * в свой день: «позвонить в четверг» надо класть в четверг, не уходя со страницы.
 */
const date = ref(props.date);
/** блок ушёл в другой день — без строки об этом он выглядит пропавшим */
const sent = ref<{ title: string; date: string } | null>(null);
const durationText = ref("");
const category = ref("");
const project = ref("");
const location = ref("");
/** online — время натикает таймером, offline — вписывается руками и таймер не нужен */
const kind = ref<"online" | "offline">("online");
const startAt = ref("");
const endAt = ref("");
const error = ref("");
const saving = ref(false);
// пустая пара полей на виду выглядит недоделанной — до первого клика её нет
const timeOpen = ref(false);

watch(
  () => props.date,
  (d) => {
    date.value = d;
    // на другой день уходят по самой же квитанции: там она врёт, что блок не здесь
    sent.value = null;
  },
);

const plannedMin = computed(() => {
  const n = Number(durationText.value.replace(/\D/g, ""));
  return n > 0 ? n : null;
});

const spanMin = computed(() => {
  const a = hhmmToMin(startAt.value);
  const b = hhmmToMin(endAt.value);
  return a !== null && b !== null && b > a ? b - a : null;
});

const spanLabel = computed(() => (spanMin.value ? hm(spanMin.value) : null));

/** «90» из списка длительностей читается как «1ч 30м» */
const minutesLabel = (value: string) => hm(Number(value));

function hm(min: number) {
  if (min < 60) return `${min}м`;
  const rest = min % 60;
  return rest ? `${Math.floor(min / 60)}ч ${rest}м` : `${Math.floor(min / 60)}ч`;
}

/** Строка над именем: куда пойдёт задача и чем станет, когда попадёт */
const statusLine = computed(() => {
  const parts = ["Задача", formatHuman(date.value, false)];
  // про чужой день статуса отсюда не видно — молчим, а не гадаем
  if (date.value === props.date) parts.push(props.dayStarted ? "вне плана" : "в плане");
  return parts.join(" · ");
});

/** Время указано — задача стоит колом; нет — плывёт вместе с днём */
const placement = computed(() => {
  if (!startAt.value || !endAt.value) {
    return "без времени задача встанет подряд от начала дня и сдвинется вместе с ним";
  }
  return kind.value === "online"
    ? "время фиксировано: блок не сдвинется, факт натикает таймером"
    : "время фиксировано: таймер не нужен, окно и есть факт";
});

async function openSheet() {
  error.value = "";
  open.value = true;
  await nextTick();
  titleInput.value?.focus();
}

const closeSheet = () => (open.value = false);

/**
 * Хоткей на создание задачи. Ловим по коду клавиши, а не по символу: на русской
 * раскладке та же клавиша даёт «т», и сравнение с «n» молча перестало бы работать
 * ровно у того, кто в этой раскладке и сидит.
 */
function onHotkey(e: KeyboardEvent) {
  if (e.code !== "KeyN" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  if (open.value || modalsOpen()) return;

  // в поле ввода «н» должно печататься, а не открывать окно
  const target = e.target as HTMLElement | null;
  if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? "")) return;

  e.preventDefault();
  openSheet();
}
onMounted(() => document.addEventListener("keydown", onHotkey));
onBeforeUnmount(() => document.removeEventListener("keydown", onHotkey));

function openTime() {
  timeOpen.value = true;
  if (!startAt.value && !endAt.value) suggestWindow();
}

function clearTime() {
  startAt.value = "";
  endAt.value = "";
  timeOpen.value = false;
  if (kind.value === "offline") kind.value = "online";
}

/** Ближайшая четверть часа: офлайн-задачу вписывают про «только что», а не с нуля */
function suggestWindow() {
  const now = new Date();
  const start =
    date.value === localDate()
      ? Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15
      : 10 * 60;
  startAt.value = minToHhmm(start);
  endAt.value = minToHhmm(Math.min(start + 60, 1440));
}

function pick(next: "online" | "offline") {
  kind.value = next;
  error.value = "";
  // офлайн без окна не существует: показываем поля сразу и заполняем разумным
  if (next === "offline") openTime();
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
  sent.value = null;
  const sentTitle = title.value.trim();
  try {
    const created = await $fetch<{ id: number }>("/api/blocks", {
      method: "POST",
      body: {
        date: date.value,
        title: title.value,
        plannedMin: plannedMin.value,
        category: category.value,
        project: project.value,
        location: location.value,
        kind: kind.value,
        startMin,
        endMin,
      },
    });

    // описание живёт первой заметкой блока: отдельного поля под него в базе нет,
    // а под маркером оно оказывается ровно там, где его станут искать
    if (description.value.trim()) {
      await $fetch<{ ok: boolean }>("/api/notes", {
        method: "POST",
        body: { blockId: created.id, text: description.value },
      });
    }

    title.value = "";
    description.value = "";
    durationText.value = "";
    // следующий блок обычно начинается там, где кончился прошлый
    if (endMin !== null) {
      startAt.value = minToHhmm(endMin);
      endAt.value = minToHhmm(Math.min(endMin + 60, 1440));
    }
    // заведённое в форме значение стало шаблоном на сервере: перечитываем,
    // иначе новый проект не появится в списке до перезагрузки страницы
    await reloadPresets();
    // ушедшее в другой день на этой странице не появится — говорим, куда оно делось
    if (date.value !== props.date) sent.value = { title: sentTitle, date: date.value };
    // категорию, место и день оставляем — подряд обычно заводят блоки одного типа
    closeSheet();
    emit("added");
  } catch (e) {
    error.value = (e as { data?: { message?: string } }).data?.message ?? "Не сохранилось";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <button type="button" class="btn-soft w-full border-dashed py-3" @click="openSheet">
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {{ label }}
      <!-- на телефоне клавиатуры под рукой нет, подсказка там только мусор -->
      <span class="hidden text-xs muted sm:inline">(N)</span>
    </button>

    <!--
      Задача ушла в день, который сейчас не открыт: в списке под формой её
      не будет, и без этого сохранение выглядит молча провалившимся.
      Строкой мелким шрифтом это не читается — внимание в момент закрытия
      модалки не здесь, поэтому плашка с кнопкой в полный рост.
    -->
    <div
      v-if="sent"
      class="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-3"
    >
      <svg viewBox="0 0 24 24" class="size-6 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6" />
      </svg>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">«{{ sent.title }}» — не в этот день</p>
        <p class="text-xs muted">
          задача легла на {{ formatHuman(sent.date, false) }},
          {{ weekdayShort(sent.date).toLowerCase() }} — в списке ниже её не будет
        </p>
      </div>

      <NuxtLink :to="{ path: '/day', query: { date: sent.date } }" class="btn-primary shrink-0 px-4 py-2.5">
        Открыть {{ formatHuman(sent.date, false) }}
      </NuxtLink>

      <button type="button" class="btn-quiet shrink-0 px-1.5" aria-label="Скрыть" @click="sent = null">✕</button>
    </div>

    <ModalSheet v-if="open" wide submit-on-enter :title="statusLine" @close="closeSheet" @enter="submit">
      <form @submit.prevent="submit">
            <input
              ref="titleInput"
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

              <DateField v-model="date" :highlight="date !== props.date" />

              <button v-if="!timeOpen" type="button" class="chip-empty" @click="openTime">
                <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="ICON.clock" />
                </svg>
                Время
              </button>

              <!-- пара времён переезжает на новую строку целиком: иначе «—» повисает в начале строки -->
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

              <PickerField
                v-model="project"
                label="Проект"
                add-label="новый проект"
                :icon="ICON.project"
                :options="projectOptions"
              />
              <PickerField
                v-model="category"
                label="Категория"
                add-label="новая категория"
                :icon="ICON.tag"
                :options="categoryOptions"
              />
              <PickerField
                v-model="location"
                label="Место"
                add-label="новое место"
                :icon="ICON.place"
                :options="placeOptions"
              />
            </div>

        <textarea
          v-model="description"
          rows="2"
          placeholder="Описание (Shift+Enter — новая строка)"
          class="mt-3 w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-black/30 dark:placeholder:text-white/25"
        />
      </form>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
          <p v-else class="text-xs muted">{{ placement }}</p>
          <button :disabled="saving || !title.trim()" class="btn-primary shrink-0 px-4" title="Enter" @click="submit">
            <Spinner v-if="saving" />
            Создать
          </button>
        </div>
      </template>
    </ModalSheet>
  </div>
</template>
