import { useState, useEffect } from "react";

export function useTheme(): string {
  const [theme, setTheme] = useState("");
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme ?? "");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
