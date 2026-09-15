<script setup lang="ts">
/**
 * Необязательный атрибут задачи: пока не заполнен — тихий чип с пунктиром,
 * по клику разворачивается в поле и сам же сворачивается обратно пустым.
 * Постоянное поле в рамке говорит «меня надо заполнить», хотя категория,
 * место и длительность нужны далеко не каждой задаче.
 */
const props = defineProps<{
  modelValue: string;
  /** подпись пустого состояния: «Категория», «Место» */
  label: string;
  /** контур иконки — рисуем сами, библиотека ради трёх картинок лишняя */
  icon: string;
  options?: string[];
  /** что показать на заполненном чипе, если значение само по себе нечитаемо */
  display?: string;
  numeric?: boolean;
  width?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [string] }>();

const editing = ref(false);
const input = ref<HTMLInputElement | null>(null);
const listId = useId();

async function edit() {
  editing.value = true;
  await nextTick();
  input.value?.focus();
}

/** пустое значение возвращает чип в исходное состояние, непустое — оставляет надпись */
function done() {
  editing.value = false;
}
</script>

<template>
  <span v-if="editing" class="inline-flex">
    <input
      ref="input"
      :value="modelValue"
      :list="options?.length ? listId : undefined"
      :inputmode="numeric ? 'numeric' : undefined"
      :placeholder="label.toLowerCase()"
      class="field py-1 text-xs"
      :class="width ?? 'w-28'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="done"
      @keydown.enter.prevent="done"
      @keydown.esc.stop="done"
    />
    <datalist v-if="options?.length" :id="listId">
      <option v-for="o in options" :key="o" :value="o" />
    </datalist>
  </span>

  <button v-else type="button" :class="modelValue ? 'chip-set' : 'chip-empty'" @click="edit">
    <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path :d="icon" />
    </svg>
    {{ modelValue ? (display ?? modelValue) : label }}
  </button>
</template>
