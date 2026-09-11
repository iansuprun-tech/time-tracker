<script setup lang="ts">
const { user, clear } = useUserSession();
const route = useRoute();
const router = useRouter();

const LINKS = [
  { to: "/", label: "Календарь" },
  { to: "/day", label: "Мой день" },
  { to: "/tomorrow", label: "Завтра" },
  { to: "/friends", label: "Друзья" },
  { to: "/settings", label: "Звуки" },
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
  <div>
    <NuxtLoadingIndicator color="#059669" :height="2" />

    <nav class="border-b border-black/10 px-4 py-3 text-sm dark:border-white/15">
      <div
        class="mx-auto flex items-center gap-4"
        :class="route.path === '/' ? 'max-w-6xl' : 'max-w-2xl'"
      >
        <NuxtLink
          v-for="l in LINKS"
          :key="l.to"
          :to="l.to"
          class="transition-colors"
          :class="
            current === l.to
              ? 'font-medium text-black dark:text-white'
              : 'text-black/60 hover:text-black/80 dark:text-white/60 dark:hover:text-white/80'
          "
        >
          {{ l.label }}
        </NuxtLink>
        <span class="ml-auto text-black/40 dark:text-white/40">{{ user?.name }}</span>
        <button
          :disabled="busy"
          class="inline-flex items-center gap-1.5 text-black/60 underline underline-offset-4 disabled:opacity-50 dark:text-white/60"
          @click="logout"
        >
          <Spinner v-if="busy" />
          выйти
        </button>
      </div>
    </nav>

    <slot />
  </div>
</template>
