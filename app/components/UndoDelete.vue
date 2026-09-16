<script setup lang="ts">
/**
 * «Задача удалена · Вернуть» внизу экрана. Подтверждение перед удалением
 * ловит промах пальцем, но не ловит передумал: увидеть, что список стал
 * не такой, можно только после удаления. Поэтому ещё и это.
 */
const { lastDeleted, dismiss, undo } = useTrash();
const busy = ref(false);

async function restore() {
  if (busy.value) return;
  busy.value = true;
  try {
    await undo();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="translate-y-3 opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="translate-y-3 opacity-0"
  >
    <div
      v-if="lastDeleted"
      class="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div
        class="flex w-full max-w-md items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-2xl dark:border-white/15 dark:bg-neutral-800"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">«{{ lastDeleted.title }}» удалена</p>
          <p class="text-xs muted">заметки и комментарии целы — лежат в корзине</p>
        </div>

        <button type="button" :disabled="busy" class="btn-primary shrink-0 px-4 py-2" @click="restore">
          <Spinner v-if="busy" />
          Вернуть
        </button>
        <button type="button" class="btn-quiet shrink-0 px-1.5" aria-label="Скрыть" @click="dismiss">✕</button>
      </div>
    </div>
  </Transition>
</template>
