import { useEffect, useRef } from "react";
import { IconPalette } from "@tabler/icons-react";

const KEY = "hl_theme";

export default function ThemeToggle() {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Sync button title to current theme once on mount
    if (btnRef.current) {
      const isDutch = document.documentElement.dataset.theme === "dutch";
      btnRef.current.title = isDutch ? "Switch to Editorial Elegance" : "Switch to Dutch Modernism";
    }
  }, []);

  function toggle() {
    const isDutch = document.documentElement.dataset.theme === "dutch";
    if (isDutch) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem(KEY, "default");
      if (btnRef.current) btnRef.current.title = "Switch to Dutch Modernism";
    } else {
      document.documentElement.dataset.theme = "dutch";
      localStorage.removeItem(KEY);
      if (btnRef.current) btnRef.current.title = "Switch to Editorial Elegance";
    }
  }

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      className="p-1.5 rounded-lg dutch:rounded-none text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors dutch:text-[#f5f3ef]/40 dutch:hover:text-[#f5f3ef] dutch:hover:bg-white/10"
    >
      <IconPalette size={16} />
    </button>
  );
}
