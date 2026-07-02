const KEY = "hl_editor";
const PASSPHRASE = "mindless";

const STATIC = import.meta.env.PUBLIC_STATIC_DATA === "true";

export function isEditor(): boolean {
  if (STATIC) return false;
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY) === "true";
}

export function unlock(input: string): boolean {
  if (input.trim() === PASSPHRASE) {
    localStorage.setItem(KEY, "true");
    window.dispatchEvent(new Event("editor-change"));
    return true;
  }
  return false;
}

export function lock(): void {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("editor-change"));
}
