/**
 * @file The site's colour theme, dark or light, shown as the `dark` class on
 * <html> that the design system's tokens follow. A visitor who picks a theme
 * with a theme toggle, any element with the toggle attribute, keeps it in
 * localStorage; until then, the page follows the OS setting, live. A browser
 * that refuses the page storage keeps no pick, and the toggles still switch
 * the theme for the page's lifetime.
 *
 * The page document's head runs `followTheme` and `handleThemeToggles` inline,
 * from their source, before the first paint, so the page never flashes the
 * wrong theme and every toggle works before any other script loads; each must
 * use nothing from outside its own body.
 */

export const THEMES = ["dark", "light"] as const;

/** One of the site's two colour themes. */
export type Theme = (typeof THEMES)[number];

// Visitors' browsers already hold their picks under this key.
export const THEME_STORAGE_KEY = "theme";

export const THEME_TOGGLE_ATTRIBUTE = "data-theme-toggle";

export function followTheme(storageKey: string): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const readPick = (): null | string => {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      // A browser set to store nothing for the page throws a SecurityError
      // from localStorage, which leaves the visitor no pick:
      // https://html.spec.whatwg.org/multipage/webstorage.html#dom-localstorage
      if (error instanceof DOMException && error.name === "SecurityError") {
        return null;
      }
      throw error;
    }
  };
  const apply = () => {
    const picked = readPick();
    // Every GitHub Pages site of this account shares this origin's
    // localStorage, so another may have written this key; a value this site
    // never writes counts as no pick, rather than breaking this page.
    const dark =
      picked === "dark" || (picked !== "light" && prefersDark.matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  apply();
  prefersDark.addEventListener("change", apply);
}

export function handleThemeToggles(
  storageKey: string,
  toggleAttribute: string,
): void {
  document.addEventListener("click", ({ target }) => {
    if (
      target instanceof Element &&
      target.closest(`[${toggleAttribute}]`) !== null
    ) {
      const dark = document.documentElement.classList.toggle("dark");
      const picked: Theme = dark ? "dark" : "light";
      try {
        localStorage.setItem(storageKey, picked);
      } catch (error) {
        // A browser that refuses the page storage throws a SecurityError, and
        // one whose storage is full a QuotaExceededError; either way the theme
        // still switches, and only the pick goes unkept:
        // https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem
        if (
          error instanceof DOMException &&
          ["QuotaExceededError", "SecurityError"].includes(error.name)
        ) {
          return;
        }
        throw error;
      }
    }
  });
}
