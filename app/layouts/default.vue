<script setup lang="ts">
const { user, clear } = useUserSession();
const route = useRoute();
const router = useRouter();

/** Иконки рисуем сами: библиотека ради шести картинок — лишняя зависимость */
const LINKS = [
  {
    to: "/",
    label: "Календарь",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  },
  {
    to: "/day",
    label: "Мой день",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4",
  },
  {
    to: "/tomorrow",
    label: "Завтра",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
  },
  {
    to: "/friends",
    label: "Друзья",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    to: "/settings",
    label: "Настройки",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  },
];

// страницы грузят данные до отрисовки, поэтому вкладка подсвечивается
// сразу по клику — иначе кажется, что не нажалось
const goingTo = ref<string | null>(null);
router.beforeEach((to) => {
  goingTo.value = to.path;
});
router.afterEach(() => {
  goingTo.value = null;
});
const current = computed(() => goingTo.value ?? route.path);

const busy = ref(false);

async function logout() {
  busy.value = true;
  try {
    await $fetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    await clear();
    await navigateTo("/login");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col md:flex-row">
    <NuxtLoadingIndicator color="#10b981" :height="2" />

    <!-- на узком экране боковая панель ложится полосой сверху -->
    <aside
      class="flex shrink-0 flex-col bg-emerald-950 text-emerald-50 md:sticky md:top-0 md:h-screen md:w-60"
    >
      <div class="flex items-center gap-2.5 px-4 py-4 md:px-5 md:py-5">
        <svg viewBox="0 0 24 24" class="size-6 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
        <span class="text-[15px] font-semibold tracking-tight">Трекер дня</span>
      </div>

      <nav class="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:px-3">
        <NuxtLink
          v-for="l in LINKS"
          :key="l.to"
          :to="l.to"
          class="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
          :class="
            current === l.to
              ? 'bg-emerald-800/70 font-medium text-white'
              : 'text-emerald-100/70 hover:bg-emerald-900/60 hover:text-white'
          "
        >
          <svg viewBox="0 0 24 24" class="size-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path :d="l.icon" />
          </svg>
          {{ l.label }}
        </NuxtLink>
      </nav>

      <div
        class="mt-auto hidden items-center gap-2.5 border-t border-white/10 px-5 py-4 text-sm md:flex"
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-800/70 text-xs font-medium"
        >
          {{ (user?.name ?? "?").slice(0, 1).toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ user?.name }}</span>
          <button
            :disabled="busy"
            class="inline-flex items-center gap-1.5 text-xs text-emerald-100/60 hover:text-white disabled:opacity-50"
            @click="logout"
          >
            <Spinner v-if="busy" />
            выйти
          </button>
        </span>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <!-- на мобиле имя и выход живут в шапке контента -->
      <div
        class="flex items-center justify-end gap-3 border-b border-black/5 px-4 py-2 text-xs md:hidden dark:border-white/10"
      >
        <span class="muted">{{ user?.name }}</span>
        <button :disabled="busy" class="btn-quiet" @click="logout">
          <Spinner v-if="busy" />
          выйти
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>
