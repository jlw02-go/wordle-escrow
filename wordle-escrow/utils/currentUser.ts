// utils/currentUser.ts
const KEY = "displayName";

export function getDisplayName(): string {
  return (localStorage.getItem(KEY) || "").trim();
}
export function setDisplayName(name: string) {
  localStorage.setItem(KEY, name.trim());
}
