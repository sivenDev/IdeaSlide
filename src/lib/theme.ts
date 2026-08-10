import type { AppSettings } from "./settings";

export type ThemePreference = AppSettings["general"]["theme"];
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

export function applyResolvedTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function observeTheme(
  preference: ThemePreference,
  onResolvedTheme: (theme: ResolvedTheme) => void,
  mediaQuery: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)"),
): () => void {
  const publish = () => onResolvedTheme(resolveTheme(preference, mediaQuery.matches));
  publish();
  if (preference !== "system") return () => undefined;
  mediaQuery.addEventListener("change", publish);
  return () => mediaQuery.removeEventListener("change", publish);
}
