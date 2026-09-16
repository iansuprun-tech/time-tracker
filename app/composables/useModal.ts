/**
 * Модалки вкладываются: список даты открывается поверх шторки создания,
 * а та — поверх страницы. Поэтому состояние общее на всё приложение.
 *
 * Фон отпирает только последняя закрывшаяся — иначе вложенный список,
 * закрывшись, разблокирует прокрутку под всё ещё открытой шторкой.
 * Esc закрывает верхнюю, а не все разом.
 */
const stack = ref<symbol[]>([]);

/** Открыта ли хоть одна модалка — чтобы хоткеи не срабатывали поверх неё */
export function modalsOpen() {
  return stack.value.length > 0;
}

export function useModal(close: () => void) {
  const id = Symbol("modal");

  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (stack.value[stack.value.length - 1] !== id) return;
    // ниже по стопке Esc уже не нужен: закрылась верхняя
    e.stopPropagation();
    close();
  }

  onMounted(() => {
    stack.value = [...stack.value, id];
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
  });

  onBeforeUnmount(() => {
    stack.value = stack.value.filter((s) => s !== id);
    if (!stack.value.length) document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  });

  /** каждая следующая модалка должна лечь поверх предыдущей */
  const zIndex = computed(() => 50 + Math.max(0, stack.value.indexOf(id)) * 10);

  /** верхняя в стопке: клавиатура принадлежит ей одной */
  const isTop = computed(() => stack.value[stack.value.length - 1] === id);

  return { zIndex, isTop };
}
