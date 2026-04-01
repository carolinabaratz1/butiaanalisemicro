import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("butia-theme") as Theme) || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("butia-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggleTheme };
};
