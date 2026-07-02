import { useState, useEffect, useRef } from "react";
import { isEditor, unlock, lock } from "../lib/editor";

type PublishState = "idle" | "running" | "done" | "error";

const STATIC = import.meta.env.PUBLIC_STATIC_DATA === "true";

export default function EditorUnlock() {
  if (STATIC) return null;
  const [editor, setEditor] = useState(() => isEditor());
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const lastE = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishLog, setPublishLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onEditorChange() { setEditor(isEditor()); }
    window.addEventListener("editor-change", onEditorChange);

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "e") {
        const now = Date.now();
        if (now - lastE.current < 500) {
          setOpen(true);
          setInput("");
          setError(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
        lastE.current = now;
      }
      if (e.key === "Escape") { setOpen(false); setShowLog(false); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("editor-change", onEditorChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [publishLog]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unlock(input)) {
      setOpen(false);
      setEditor(true);
    } else {
      setError(true);
    }
  }

  async function handlePublish() {
    setPublishState("running");
    setPublishLog([]);
    setShowLog(true);
    try {
      const res = await fetch("/api/publish", { method: "POST" });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        setPublishLog(prev => [...prev, ...text.split("\n").filter(l => l.trim())]);
      }
      setPublishState("done");
    } catch (err) {
      setPublishLog(prev => [...prev, `Error: ${err}`]);
      setPublishState("error");
    }
  }

  return (
    <>
      {editor && (
        <div className="fixed bottom-20 right-4 md:bottom-4 z-50 flex flex-col items-end gap-2">
          <button
            onClick={handlePublish}
            disabled={publishState === "running"}
            className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishState === "running" ? "publishing…" : publishState === "done" ? "published ✓" : "publish"}
          </button>
          <button
            onClick={() => { lock(); setEditor(false); }}
            className="text-[10px] uppercase tracking-widest text-neutral-300 hover:text-neutral-500 transition-colors"
          >
            lock
          </button>
        </div>
      )}

      {showLog && (
        <div className="fixed inset-0 z-[200] flex items-end justify-end p-4 pointer-events-none">
          <div className="pointer-events-auto bg-neutral-950 text-neutral-200 rounded-xl w-96 max-h-72 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800">
              <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                {publishState === "running" ? "Publishing…" : publishState === "done" ? "Published" : "Error"}
              </span>
              <button onClick={() => { setShowLog(false); setPublishState("idle"); }} className="text-neutral-500 hover:text-neutral-300 text-xs">✕</button>
            </div>
            <div ref={logRef} className="overflow-y-auto px-4 py-3 flex-1 no-scrollbar">
              {publishLog.map((line, i) => (
                <p key={i} className="text-xs font-mono leading-relaxed text-neutral-300">{line}</p>
              ))}
              {publishState === "running" && (
                <p className="text-xs font-mono text-neutral-500 animate-pulse">…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl px-8 py-7 w-72 flex flex-col gap-4"
          >
            <p className="text-sm text-neutral-500 text-center tracking-wide">Enter passphrase</p>
            <input
              ref={inputRef}
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              className={`border rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none transition-colors ${error ? "border-red-300" : "border-neutral-200 focus:border-neutral-400"}`}
              placeholder="••••••••"
            />
            {error && <p className="text-xs text-red-400 -mt-2 text-center">Wrong passphrase</p>}
            <button
              type="submit"
              disabled={!input}
              className="bg-neutral-900 text-white text-sm rounded-lg py-2.5 hover:bg-neutral-700 transition-colors disabled:opacity-40"
            >
              Unlock
            </button>
          </form>
        </div>
      )}
    </>
  );
}
