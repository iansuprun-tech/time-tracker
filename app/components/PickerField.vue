<script setup lang="ts">
/**
 * Атрибут задачи: пока не заполнен — тихий чип с пунктиром, по клику
 * открывается модалка со списком заведённых значений и строкой, чтобы
 * завести новое.
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

async function openModal() {
  draft.value = "";
  open.value = true;
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
</script>

<template>
  <div class="contents">
    <button type="button" :class="modelValue ? 'chip-set' : 'chip-empty'" @click="openModal">
      <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path :d="icon" />
      </svg>
      {{ modelValue ? show(modelValue) : label }}
    </button>

    <ModalSheet v-if="open" :title="label" @close="open = false">
      <div class="mb-2 flex gap-1">
        <input
          ref="input"
          v-model="draft"
          :placeholder="addLabel"
          :inputmode="numeric ? 'numeric' : undefined"
          class="field min-w-0 flex-1 py-1.5 text-sm"
          @keydown.enter.prevent="create"
        />
        <button
          type="button"
          :disabled="!draft.trim() || exists"
          class="btn-soft shrink-0 px-3 py-1.5 text-sm"
          :title="exists ? 'Такое уже есть в списке' : 'Завести новое'"
          @click="create"
        >
          +
        </button>
      </div>

      <ul v-if="shown.length" class="-mx-1">
        <li v-for="o in shown" :key="o">
          <button
            type="button"
            class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.05] dark:hover:bg-white/10"
            :class="o === modelValue ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''"
            @click="choose(o)"
          >
            {{ show(o) }}
          </button>
        </li>
      </ul>

      <p v-else class="px-1 py-2 text-xs muted">
        {{ draft.trim() ? "Ничего не нашлось — можно завести" : "Пока пусто — заведите первый" }}
      </p>

      <button
        v-if="modelValue"
        type="button"
        class="mt-2 w-full rounded-lg border-t border-black/[0.06] px-3 py-2 text-left text-xs muted transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:hover:bg-white/10"
        @click="choose('')"
      >
        убрать
      </button>
    </ModalSheet>
  </div>
</template>
