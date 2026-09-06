import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()] },
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
