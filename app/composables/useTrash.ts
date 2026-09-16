/**
 * Только что удалённая задача. Живёт одна на всё приложение: удаляют из строки
 * блока и из окна правки, а «вернуть» должно всплыть одинаково в обоих случаях
 * и пережить закрытие модалки, из которой удаляли.
 */
const lastDeleted = ref<{ id: number; title: string } | null>(null);

export function useTrash() {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function remember(id: number, title: string) {
    lastDeleted.value = { id, title };
    clearTimeout(timer);
    // всплывашка не должна висеть вечно: не вернули сразу — вернут из корзины
    timer = setTimeout(() => (lastDeleted.value = null), 12_000);
  }

  function dismiss() {
    clearTimeout(timer);
    lastDeleted.value = null;
  }

  async function undo() {
    const item = lastDeleted.value;
    if (!item) return;
    dismiss();
    await $fetch<{ ok: boolean }>("/api/blocks/restore", { method: "POST", body: { id: item.id } });
    // страницы держат свои данные через useFetch — перечитываем разом
    await refreshNuxtData();
  }

  return { lastDeleted, remember, dismiss, undo };
}
