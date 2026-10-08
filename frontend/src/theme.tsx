import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";

const KEY = "gridline.theme";
const ThemeContext = createContext<{ theme: Theme; toggle: (origin?: { x: number; y: number }) => void } | null>(null);

function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(KEY, theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggle(origin?: { x: number; y: number }) {
        const next: Theme = themeRef.current === "light" ? "dark" : "light";
        const commit = () => {
          applyTheme(next);
          flushSync(() => setTheme(next));
        };
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || typeof document.startViewTransition !== "function") {
          commit();
          return;
        }
        const x = origin?.x ?? window.innerWidth / 2;
        const y = origin?.y ?? window.innerHeight / 2;
        let transition: ViewTransition;
        try {
          transition = document.startViewTransition(commit);
        } catch {
          commit();
          return;
        }
        transition.ready
          .then(() => {
            const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
            document.documentElement.animate(
              {
                clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
              },
              {
                duration: 700,
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
              },
            );
          })
          .catch(() => undefined);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is missing");
  return value;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        toggle({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon size={16} className="theme-icon" />
      {compact ? null : <span>{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}
