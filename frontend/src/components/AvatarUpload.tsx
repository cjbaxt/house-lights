import { useState, useRef } from "react";
import { createClient } from "../lib/supabase/client";
import { IconCamera } from "@tabler/icons-react";

interface Props {
  currentUrl?: string | null;
  username: string;
}

export default function AvatarUpload({ currentUrl, username }: Props) {
  const [url, setUrl] = useState(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Max file size is 2 MB."); return; }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const busted = `${publicUrl}?t=${Date.now()}`;

    const { error: updateErr } = await supabase.from("profile").update({ avatar_url: busted }).eq("id", user.id);
    if (updateErr) { setError(updateErr.message); setUploading(false); return; }

    setUrl(busted);
    setUploading(false);
  }

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-16 h-16 rounded-full overflow-hidden border border-[#ece7de] bg-[#f0ede8] hover:opacity-80 transition-opacity group flex-shrink-0"
        disabled={uploading}
        title="Change photo"
      >
        {url
          ? <img src={url} alt="Avatar" className="w-full h-full object-cover" />
          : <span className="text-sm font-bold text-[#888]">{initials}</span>
        }
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <IconCamera size={16} className="text-white" />
        </div>
      </button>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors underline"
        >
          {uploading ? "Uploading…" : "Change photo"}
        </button>
        {error && <p className="text-xs text-[#e85d2f] mt-1">{error}</p>}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden" onChange={handleFile} />
    </div>
  );
}
