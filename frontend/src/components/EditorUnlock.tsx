import { useState, useEffect, useRef } from "react";
import { isEditor, unlock, lock } from "../lib/editor";

export default function EditorUnlock() {
  const [editor, setEditor] = useState(() => isEditor());
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const lastE = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("editor-change", onEditorChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unlock(input)) {
      setOpen(false);
      setEditor(true);
    } else {
      setError(true);
    }
  }

  return (
    <>
      {editor && (
        <div className="fixed bottom-20 right-4 md:bottom-4 z-50 flex flex-col items-end gap-2">
          <span
            title="Publish to GitHub Pages — coming soon"
            className="text-[10px] uppercase tracking-widest text-neutral-200 cursor-not-allowed select-none"
          >
            publish
          </span>
          <button
            onClick={() => { lock(); setEditor(false); }}
            className="text-[10px] uppercase tracking-widest text-neutral-300 hover:text-neutral-500 transition-colors"
          >
            lock
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20"
          onClick={() => setOpen(false)}
        >
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
              className={`border rounded-lg px-4 py-2.5 text-sm text-neutral-900 focus:outline-none transition-colors ${
                error ? "border-red-300" : "border-neutral-200 focus:border-neutral-400"
              }`}
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
