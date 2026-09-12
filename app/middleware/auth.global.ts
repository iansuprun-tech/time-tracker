const PUBLIC = ["/login", "/register", "/forgot"];

// приглашение открывается и без аккаунта — регистрация происходит прямо на нём,
// ссылка из письма — тем более: её открывают именно потому, что войти не могут
const isInvite = (path: string) => path.startsWith("/invite-");
const isReset = (path: string) => path.startsWith("/reset-");

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();

  if (!loggedIn.value && !PUBLIC.includes(to.path) && !isInvite(to.path) && !isReset(to.path)) {
    return navigateTo("/login");
  }
  if (loggedIn.value && PUBLIC.includes(to.path)) return navigateTo("/");
});
