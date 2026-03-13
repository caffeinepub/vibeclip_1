import { useInternetIdentity } from "./useInternetIdentity";

export function useAuth() {
  const { login, clear, loginStatus, identity, isInitializing } =
    useInternetIdentity();

  // isAuthenticated is true whenever there's a valid non-anonymous identity,
  // regardless of whether loginStatus is "success" (restored sessions
  // stay at "idle" but still have a valid identity).
  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  return {
    isAuthenticated,
    isInitializing,
    login,
    logout: clear,
    principal: identity?.getPrincipal() ?? null,
    loginStatus,
  };
}
