type Sortable = { id: number };
type Slot = { id: number; top: number; height: number };

/**
 * Перетаскивание элементов списка: мышью и пальцем одинаково.
 *
 * Порядок в DOM во время перетаскивания не меняется — иначе блок уезжает
 * из-под пальца, снова попадает под него и список начинает дрожать.
 * Вместо этого блоки разъезжаются трансформами по замеренным на старте
 * местам, а настоящий порядок применяется один раз, на отпускании.
 */
export function useDragSort<T extends Sortable>(
  source: () => T[],
  save: (ids: number[]) => Promise<void>,
) {
  // локальный порядок живёт от отпускания до ответа сервера
  const order = ref<number[] | null>(null);
  const draggingId = ref<number | null>(null);
  const offset = ref(0);
  const shifts = ref(new Map<number, number>());

  let slots: Slot[] = [];
  let gap = 8;
  let startY = 0;
  let fromIndex = 0;
  let toIndex = 0;

  const items = computed<T[]>(() => {
    const list = source();
    const ids = order.value;
    if (!ids) return list;
    const byId = new Map(list.map((it) => [it.id, it]));
    const moved = ids.map((id) => byId.get(id)).filter((it): it is T => Boolean(it));
    // если блок появился, пока мы тащили, — пусть подождёт в хвосте
    return [...moved, ...list.filter((it) => !ids.includes(it.id))];
  });

  /** Порядок, в котором блоки лягут, если отпустить прямо сейчас */
  function orderAt(index: number) {
    const ids = slots.map((s) => s.id);
    const [dragged] = ids.splice(fromIndex, 1);
    ids.splice(index, 0, dragged!);
    return ids;
  }

  /** Куда каждый блок должен уехать, чтобы освободить место под рукой */
  function layout(index: number) {
    const ids = orderAt(index);
    const byId = new Map(slots.map((s) => [s.id, s]));
    const next = new Map<number, number>();

    let top = slots[0]!.top;
    for (const id of ids) {
      const slot = byId.get(id)!;
      if (id !== draggingId.value) next.set(id, top - slot.top);
      top += slot.height + gap;
    }
    shifts.value = next;
  }

  function onMove(event: PointerEvent) {
    if (draggingId.value == null) return;
    const from = slots[fromIndex]!;
    offset.value = event.clientY - startY;

    // порог считаем по неподвижным замерам: тогда он зависит только от руки
    // и не пляшет вслед за разъехавшимся списком
    const center = from.top + offset.value + from.height / 2;
    const index = slots.filter((s, i) => i !== fromIndex && s.top + s.height / 2 < center).length;

    if (index !== toIndex) {
      toIndex = index;
      layout(index);
    }
  }

  async function finish() {
    detach();
    const moved = toIndex !== fromIndex;
    const ids = orderAt(toIndex);

    draggingId.value = null;
    offset.value = 0;
    shifts.value = new Map();
    if (!moved) return;

    // порядок применяем сразу: блоки уже стоят по местам, ждать сервер нечего
    order.value = ids;
    try {
      await save(ids);
    } finally {
      // порядок с сервера приехал; если запрос упал — список вернётся как был
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
    const handle = event.target as HTMLElement;
    const list = handle.closest("ul");
    if (!list) return;

    slots = [...list.querySelectorAll<HTMLElement>("[data-block-id]")].map((el) => {
      const box = el.getBoundingClientRect();
      return { id: Number(el.dataset.blockId), top: box.top, height: box.height };
    });
    const index = slots.findIndex((s) => s.id === id);
    if (index < 0) return;

    // иначе палец потащит страницу, а мышь выделит текст
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);

    const next = slots[1];
    if (next) gap = next.top - (slots[0]!.top + slots[0]!.height);
    startY = event.clientY;
    fromIndex = index;
    toIndex = index;
    draggingId.value = id;
    offset.value = 0;
    shifts.value = new Map();
    attach();
  }

  /** Блок под рукой едет за ней без задержки, остальные — плавно расступаются */
  function styleFor(id: number) {
    if (draggingId.value == null) return undefined;
    if (id === draggingId.value) {
      return {
        transform: `translateY(${offset.value}px)`,
        transition: "none",
        position: "relative",
        zIndex: "20",
      };
    }
    return {
      transform: `translateY(${shifts.value.get(id) ?? 0}px)`,
      transition: "transform 150ms ease",
    };
  }

  onScopeDispose(detach);

  return { items, draggingId, start, styleFor };
}
