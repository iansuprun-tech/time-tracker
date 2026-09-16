<script setup lang="ts">
/**
 * Оболочка модального окна: затемнение, шторка снизу на телефоне и окно
 * по центру на большом экране, Esc и клик по фону.
 *
 * Через неё же открываются все списки выбора. Приклеенный к кнопке список
 * приходится позиционировать руками, он режется прокруткой родителя, дерётся
 * за z-index и на телефоне выходит мельче пальца. Модалка снимает весь этот
 * класс бед разом и ведёт себя одинаково везде.
 */
defineProps<{
  title?: string;
  /** широкое окно — для формы, узкое — для списка выбора */
  wide?: boolean;
}>();
const emit = defineEmits<{ close: [] }>();

const { zIndex } = useModal(() => emit("close"));
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 flex items-end justify-center sm:items-center" :style="{ zIndex }">
      <div class="absolute inset-0 bg-black/40" @click="emit('close')" />

      <div
        class="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-neutral-900 sm:rounded-2xl"
        :class="wide ? 'sm:max-w-lg' : 'sm:max-w-xs'"
      >
        <div class="shrink-0 px-4 pt-3 sm:px-5">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" />
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 text-xs muted">
              <slot name="title">{{ title }}</slot>
            </div>
            <button type="button" class="btn-quiet -mt-1 px-1.5" aria-label="Закрыть" @click="emit('close')">
              ✕
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
          <slot />
        </div>

        <div
          v-if="$slots.footer"
          class="shrink-0 border-t border-black/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 sm:px-5"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
