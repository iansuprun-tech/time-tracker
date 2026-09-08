<script setup lang="ts">
const { user, clear } = useUserSession();

async function logout() {
  await $fetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  await clear();
  await navigateTo("/login");
}
</script>

<template>
  <div>
    <nav
      class="border-b border-black/10 px-4 py-3 text-sm dark:border-white/15"
    >
      <div class="mx-auto flex max-w-2xl items-center gap-4">
        <NuxtLink to="/" class="font-medium">Мой день</NuxtLink>
        <NuxtLink to="/tomorrow" class="text-black/60 dark:text-white/60">Завтра</NuxtLink>
        <NuxtLink to="/friends" class="text-black/60 dark:text-white/60">Друзья</NuxtLink>
        <NuxtLink to="/settings" class="text-black/60 dark:text-white/60">Звуки</NuxtLink>
        <span class="ml-auto text-black/40 dark:text-white/40">{{ user?.name }}</span>
        <button class="text-black/60 underline underline-offset-4 dark:text-white/60" @click="logout">
          выйти
        </button>
      </div>
    </nav>

    <slot />
  </div>
</template>
