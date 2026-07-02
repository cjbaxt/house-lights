import { useState, useEffect } from "react";
import { IconMoon, IconSun } from "@tabler/icons-react";

const KEY = "hl_theme";

export default function ThemeToggle() {
  const [isGlow, setIsGlow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "glow") {
      setIsGlow(true);
      document.documentElement.dataset.theme = "glow";
    }
  }, []);

  function toggle() {
    const next = !isGlow;
    setIsGlow(next);
    if (next) {
      document.documentElement.dataset.theme = "glow";
      localStorage.setItem(KEY, "glow");
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(KEY);
    }
  }

  return (
    <button
      onClick={toggle}
      title={isGlow ? "Switch to light theme" : "Switch to glow theme"}
      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors glow:text-[#4a4560] glow:hover:text-[#ede8f5] glow:hover:bg-[#1a1826]"
    >
      {isGlow ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}
