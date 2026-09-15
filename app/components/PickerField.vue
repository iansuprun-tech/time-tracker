<script setup lang="ts">
/**
 * Атрибут задачи: пока не заполнен — тихий чип с пунктиром, по клику
 * открывается список уже заведённых значений и строка, чтобы завести новое.
 *
 * Нативный datalist тут не годится: на телефоне список подсказок не всплывает,
 * и поле выглядит просто пустой строкой — по ней не догадаешься, что проекты
 * где-то уже есть. Заводить новый приходится вслепую, дублируя старые.
 */
const props = defineProps<{
  modelValue: string;
  /** подпись пустого чипа: «Проект», «Категория» */
  label: string;
  /** подсказка в строке создания: «новый проект» */
  addLabel: string;
  /** контур иконки — рисуем сами, библиотека ради четырёх картинок лишняя */
  icon: string;
  options?: string[];
  /** как показать значение, если само по себе оно нечитаемо: «90» → «1ч 30м» */
  optionLabel?: (value: string) => string;
  numeric?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const open = ref(false);
const draft = ref("");
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

const show = (value: string) => props.optionLabel?.(value) ?? value;

/** введённое фильтрует список: с десятком проектов листать уже долго */
const shown = computed(() => {
  const q = draft.value.trim().toLowerCase();
  const all = props.options ?? [];
  return q ? all.filter((o) => o.toLowerCase().includes(q)) : all;
});

/** такое значение уже заведено — предлагать «создать» второй раз незачем */
const exists = computed(() =>
  (props.options ?? []).some((o) => o.toLowerCase() === draft.value.trim().toLowerCase()),
);

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  draft.value = "";
  await nextTick();
  input.value?.focus();
}

function choose(value: string) {
  open.value = false;
  emit("update:modelValue", value);
}

/** Enter по набранному — то же «создать»: отдельная кнопка нужна только пальцу */
function create() {
  const value = draft.value.trim();
  if (value) choose(value);
}

function onDocumentPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("pointerdown", onDocumentPointer));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocumentPointer));
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" :class="modelValue ? 'chip-set' : 'chip-empty'" @click="toggle">
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path :d="icon" />
      </svg>
      {{ modelValue ? show(modelValue) : label }}
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-black/10 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-neutral-800"
    >
      <ul v-if="shown.length" class="max-h-44 overflow-auto">
        <li v-for="o in shown" :key="o">
          <button
            type="button"
            class="w-full px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
            :class="o === modelValue ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''"
            @click="choose(o)"
          >
            {{ show(o) }}
          </button>
        </li>
      </ul>

      <p v-else class="px-2.5 py-1.5 text-[11px] muted">
        {{ draft.trim() ? "Ничего не нашлось" : "Пока пусто — заведите первый" }}
      </p>

      <div class="mt-1 flex gap-1 border-t border-black/10 px-1.5 pb-1 pt-1.5 dark:border-white/15">
        <input
          ref="input"
          v-model="draft"
          :placeholder="addLabel"
          :inputmode="numeric ? 'numeric' : undefined"
          class="field min-w-0 flex-1 py-1 text-xs"
          @keydown.enter.prevent="create"
          @keydown.esc.stop="open = false"
        />
        <button
          type="button"
          :disabled="!draft.trim() || exists"
          class="btn-soft shrink-0 px-2 py-1 text-xs"
          :title="exists ? 'Такое уже есть в списке' : 'Завести новое'"
          @click="create"
        >
          +
        </button>
      </div>

      <button
        v-if="modelValue"
        type="button"
        class="w-full px-2.5 py-1 text-left text-[11px] muted transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
        @click="choose('')"
      >
        убрать
      </button>
    </div>
  </div>
</template>
