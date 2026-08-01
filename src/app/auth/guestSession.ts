export const GUEST_SESSION_KEY = "nodebook:guest-session";

export function hasGuestSession(storage: Pick<Storage, "getItem"> | undefined = typeof sessionStorage === "undefined" ? undefined : sessionStorage) {
  return storage?.getItem(GUEST_SESSION_KEY) === "1";
}

export function startGuestSession(storage: Pick<Storage, "setItem"> = sessionStorage) {
  storage.setItem(GUEST_SESSION_KEY, "1");
}

export function endGuestSession(storage: Pick<Storage, "removeItem"> = sessionStorage) {
  storage.removeItem(GUEST_SESSION_KEY);
}
