type Sortable = { id: number };

/**
 * Перетаскивание элементов списка: мышью и пальцем одинаково.
 * Во время перетаскивания порядок живёт локально — список должен ехать
 * под рукой, а не после ответа сервера. Элементы ищутся по data-block-id.
 */
export function useDragSort<T extends Sortable>(
  source: () => T[],
  save: (ids: number[]) => Promise<void>,
) {
  const order = ref<number[] | null>(null);
  const draggingId = ref<number | null>(null);
  let initial = "";

  const items = computed<T[]>(() => {
    const list = source();
    const ids = order.value;
    if (!ids) return list;
    const byId = new Map(list.map((it) => [it.id, it]));
    const moved = ids.map((id) => byId.get(id)).filter((it): it is T => Boolean(it));
    // если блок появился, пока мы тащим, — пусть подождёт в хвосте
    return [...moved, ...list.filter((it) => !ids.includes(it.id))];
  });

  function idUnder(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-block-id]");
    return el ? Number(el.dataset.blockId) : null;
  }

  function onMove(event: PointerEvent) {
    const id = draggingId.value;
    const overId = idUnder(event.clientX, event.clientY);
    if (id == null || overId == null || overId === id || !order.value) return;

    const from = order.value.indexOf(id);
    const to = order.value.indexOf(overId);
    if (from < 0 || to < 0) return;

    const next = [...order.value];
    next.splice(from, 1);
    next.splice(to, 0, id);
    order.value = next;
  }

  async function finish() {
    detach();
    draggingId.value = null;
    const ids = order.value;
    if (!ids || ids.join(",") === initial) {
      order.value = null;
      return;
    }
    try {
      await save(ids);
    } finally {
      // порядок с сервера уже приехал; при ошибке список вернётся как был
      order.value = null;
    }
  }

  function attach() {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function detach() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
  }

  function start(id: number, event: PointerEvent) {
    if (draggingId.value != null) return;
    // иначе палец потащит страницу, а мышь выделит текст
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    draggingId.value = id;
    order.value = source().map((it) => it.id);
    initial = order.value.join(",");
    attach();
  }

  onScopeDispose(detach);

  return { items, draggingId, start };
}
