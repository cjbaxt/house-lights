import { useState, useEffect } from "react";

export function useTheme(): string {
  const [theme, setTheme] = useState(() => {
    // SSR: assume Dutch (default) to avoid hydration mismatch for most users
    if (typeof window === "undefined") return "dutch";
    // Client: read DOM immediately so Dutch-mode users see no flash on mount
    return document.documentElement.dataset.theme ?? "";
  });
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme ?? "");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
