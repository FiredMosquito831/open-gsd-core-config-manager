let consumed = false;
let launchToken: string | null = null;

/** Reads the launch token once, strips it from the URL, and retains it only in memory. */
export function consumeLaunchToken(): string | null {
  if (consumed) return launchToken;
  consumed = true;
  launchToken = new URLSearchParams(window.location.search).get('t');
  window.history.replaceState({}, '', window.location.pathname);
  return launchToken;
}

/** Future API clients use this value exclusively for the x-gsd-token header. */
export function getLaunchToken(): string | null {
  return launchToken;
}