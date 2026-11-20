/**
 * The player's own Anthropic API key, kept in this browser only. Every function takes the Storage
 * to use and never throws, so a browser that blocks storage (private mode, blocked site data) still
 * lets the coach work: the key then lasts only for this visit.
 */
export const KEY_STORAGE_NAME = 'guitarpulse.anthropicKey';

/** The trimmed key, or null when the text can't be an Anthropic API key. */
export function cleanKey(raw: string): string | null {
  const key = raw.trim();
  return key.startsWith('sk-ant-') && !/\s/.test(key) ? key : null;
}

/** This browser's localStorage, or null when there is none or access is blocked. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadKey(storage: Storage | null): string | null {
  try {
    return storage?.getItem(KEY_STORAGE_NAME) ?? null;
  } catch {
    return null;
  }
}

/** Saves the key; false when this browser won't store it. */
export function saveKey(storage: Storage | null, key: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY_STORAGE_NAME, key);
    return true;
  } catch {
    return false;
  }
}

export function forgetKey(storage: Storage | null): void {
  try {
    storage?.removeItem(KEY_STORAGE_NAME);
  } catch {
    // Storage is blocked, so nothing was saved to forget.
  }
}
