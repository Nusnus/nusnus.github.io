/**
 * @file The theme: the visitor's pick wins and persists, while a value this
 * site never writes counts as none; without a pick, the page follows the OS
 * setting as it changes; and a click on any theme toggle switches the theme
 * and keeps the result as the pick. Storage the browser refuses counts as no
 * pick and leaves the toggles working; any other failure of storage goes
 * through.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  followTheme,
  handleThemeToggles,
  type Theme,
  THEME_STORAGE_KEY,
  THEME_TOGGLE_ATTRIBUTE,
} from "../../../src/theme/theme.ts";
import { findElement, fireEvent, happyDOM } from "../../fixtures/unit-page.ts";

function setOsTheme(theme: Theme): void {
  happyDOM.settings.device.prefersColorScheme = theme;
  // happy-dom re-evaluates media queries on resize.
  window.dispatchEvent(new Event("resize"));
}

// Chromium's error for a page whose storage the browser refuses.
const STORAGE_REFUSED = new DOMException(
  "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
  "SecurityError",
);

// A failure of storage the browser reports for another reason than refusing
// the page storage.
const STORAGE_BROKEN = new DOMException("Storage broke.", "UnknownError");

// Fails every use of localStorage with the error.
function refuseStorage(error: Error): void {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw error;
  });
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  setOsTheme("light");
});

describe("THEME_STORAGE_KEY", () => {
  it("is the key visitors' browsers already hold their picks under", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});

describe("THEME_TOGGLE_ATTRIBUTE", () => {
  it("is a data attribute, which HTML leaves to the page", () => {
    expect(THEME_TOGGLE_ATTRIBUTE).toBe("data-theme-toggle");
  });
});

describe("followTheme", () => {
  it.each<[string, Theme, boolean]>([
    ["dark", "light", true],
    ["light", "dark", false],
    ["blue", "dark", true],
    ["blue", "light", false],
  ])(
    "with %s picked and a %s OS, shows the dark theme exactly when the pick, or failing one the OS, is dark",
    (picked, osTheme, dark) => {
      localStorage.setItem("picked-theme", picked);
      setOsTheme(osTheme);

      followTheme("picked-theme");

      expect(isDark()).toBe(dark);
    },
  );

  it.each<[Theme, boolean]>([
    ["dark", true],
    ["light", false],
  ])("with no pick and a %s OS, shows the OS's theme", (osTheme, dark) => {
    setOsTheme(osTheme);

    followTheme("picked-theme");

    expect(isDark()).toBe(dark);
  });

  it("follows the OS as it changes while the visitor has picked no theme", () => {
    followTheme("picked-theme");

    setOsTheme("dark");

    expect(isDark()).toBe(true);
  });

  it("keeps the visitor's pick when the OS changes", () => {
    localStorage.setItem("picked-theme", "light");
    followTheme("picked-theme");

    setOsTheme("dark");

    expect(isDark()).toBe(false);
  });

  it("with storage the browser refuses, shows the OS's theme", () => {
    setOsTheme("dark");
    refuseStorage(STORAGE_REFUSED);

    followTheme("picked-theme");

    expect(isDark()).toBe(true);
  });

  it("lets any other failure to read the pick through", () => {
    refuseStorage(STORAGE_BROKEN);

    expect(() => {
      followTheme("picked-theme");
    }).toThrow(new DOMException("Storage broke.", "UnknownError"));
  });
});

describe("handleThemeToggles", () => {
  beforeAll(() => {
    handleThemeToggles("picked-theme", "data-toggle");
  });

  it.each<[boolean, boolean, Theme]>([
    [true, false, "light"],
    [false, true, "dark"],
  ])(
    "on a click inside a toggle with the dark class %s, sets it to %s and keeps the %s theme as the pick",
    (dark, darkAfter, picked) => {
      document.body.innerHTML =
        "<button data-toggle><span>Switch</span></button>";
      document.documentElement.classList.toggle("dark", dark);

      fireEvent.click(findElement(document, "span"));

      expect([isDark(), localStorage.getItem("picked-theme")]).toStrictEqual([
        darkAfter,
        picked,
      ]);
    },
  );

  it.each([
    STORAGE_REFUSED,
    new DOMException(
      "Failed to execute 'setItem' on 'Storage': Setting the value of 'picked-theme' exceeded the quota.",
      "QuotaExceededError",
    ),
  ])(
    "switches the theme on a toggle's click even when storage refuses the pick, with $name",
    (error) => {
      document.body.innerHTML = "<button data-toggle></button>";
      refuseStorage(error);

      fireEvent.click(findElement(document, "button"));

      expect(isDark()).toBe(true);
    },
  );

  it("lets any other failure to keep the pick through", () => {
    document.body.innerHTML = "<button data-toggle></button>";
    refuseStorage(STORAGE_BROKEN);

    expect(() => {
      fireEvent.click(findElement(document, "button"));
    }).toThrow(new DOMException("Storage broke.", "UnknownError"));
  });

  it("leaves the theme alone on a click outside every toggle", () => {
    document.body.innerHTML = "<button data-toggle></button><p>Text</p>";

    fireEvent.click(findElement(document, "p"));

    expect([isDark(), localStorage.getItem("picked-theme")]).toStrictEqual([
      false,
      null,
    ]);
  });
});
