import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["nuxt-auth-utils"],
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()] },
  // календарь переехал на главную, но открытые вкладки и закладки помнят старый адрес
  routeRules: { "/week": { redirect: "/" } },
  app: {
    head: {
      title: "Трекер дня",
      htmlAttrs: { lang: "ru" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#0a0a0a" },
        // чтобы с домашнего экрана открывалось без адресной строки
        { name: "mobile-web-app-capable", content: "yes" },
      ],
    },
  },
});
