import { useState, useEffect } from "react";
import { IconPalette } from "@tabler/icons-react";

const KEY = "hl_theme";

export default function ThemeToggle() {
  const [isDutch, setIsDutch] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "dutch") {
      setIsDutch(true);
      document.documentElement.dataset.theme = "dutch";
    }
  }, []);

  function toggle() {
    const next = !isDutch;
    setIsDutch(next);
    if (next) {
      document.documentElement.dataset.theme = "dutch";
      localStorage.setItem(KEY, "dutch");
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(KEY);
    }
  }

  return (
    <button
      onClick={toggle}
      title={isDutch ? "Switch to default theme" : "Switch to Dutch modern theme"}
      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors dutch:text-[#f5f3ef]/40 dutch:hover:text-[#f5f3ef] dutch:hover:bg-white/10"
    >
      <IconPalette size={16} />
    </button>
  );
}
