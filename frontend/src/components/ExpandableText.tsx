import { useState, useRef, useLayoutEffect } from "react";

export default function ExpandableText({
  text,
  className = "",
  lines = 2,
}: {
  text: string;
  className?: string;
  lines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div>
      <p
        ref={ref}
        className={`${className} ${expanded ? "" : `line-clamp-${lines}`}`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
          className="text-[10px] font-bold text-[#aaa] uppercase tracking-widest mt-1 hover:text-[#666] transition-colors"
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}
