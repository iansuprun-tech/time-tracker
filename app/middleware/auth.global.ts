const PUBLIC = ["/login", "/register"];

// приглашение открывается и без аккаунта — регистрация происходит прямо на нём
const isInvite = (path: string) => path.startsWith("/invite-");

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();

  if (!loggedIn.value && !PUBLIC.includes(to.path) && !isInvite(to.path)) return navigateTo("/login");
  if (loggedIn.value && PUBLIC.includes(to.path)) return navigateTo("/");
});
