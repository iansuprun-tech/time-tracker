/**
 * Выпадающий список, приклеенный к своей кнопке, но живущий в <body>.
 *
 * Внутри шторки любой `absolute`-список режется её прокруткой: шторка обязана
 * скроллиться, иначе не влезет на телефон, а список обязан быть виден целиком.
 * Совместить это можно только вынув список из прокручиваемого ящика — значит,
 * координаты приходится считать руками.
 *
 * Заодно решается вторая беда: список у нижнего края экрана открывается вверх,
 * а не уезжает за границу окна.
 */
export function usePopover(
  anchor: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  width: number,
) {
  const style = ref<Record<string, string>>({});
  const GAP = 4;
  const EDGE = 8;

  function place() {
    const el = anchor.value;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - EDGE * 2);
    // за правый край не вылезаем, за левый тоже
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - w));

    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    // снизу тесно, а сверху просторнее — открываемся вверх
    const up = below < 180 && above > below;

    style.value = {
      position: "fixed",
      left: `${left}px`,
      width: `${w}px`,
      maxHeight: `${Math.max(120, up ? above : below)}px`,
      ...(up
        ? { bottom: `${window.innerHeight - r.top + GAP}px` }
        : { top: `${r.bottom + GAP}px` }),
    };
  }

  watch(open, async (v) => {
    if (!v) return;
    await nextTick();
    place();
  });

  onMounted(() => {
    // capture: прокрутка случается внутри шторки, а не в окне
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("scroll", place, true);
    window.removeEventListener("resize", place);
  });

  return { style, place };
}
