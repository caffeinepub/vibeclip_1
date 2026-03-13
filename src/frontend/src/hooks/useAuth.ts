import { useInternetIdentity } from "./useInternetIdentity";

export function useAuth() {
  const { login, clear, loginStatus, identity, isInitializing } =
    useInternetIdentity();

  return {
    isAuthenticated: loginStatus === "success" && !!identity,
    isInitializing,
    login,
    logout: clear,
    principal: identity?.getPrincipal() ?? null,
    loginStatus,
  };
}
