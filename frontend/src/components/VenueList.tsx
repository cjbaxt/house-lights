import { useState, useEffect } from "react";
import type React from "react";
import { api } from "../lib/api";
import { isEditor } from "../lib/editor";
import type { Venue, Company } from "../lib/api";
import { IconPencil, IconX, IconCheck } from "@tabler/icons-react";
import ExpandableText from "./ExpandableText";

type Tab = "venues" | "companies";
type Priority = "high" | "medium" | "low";

const PRIORITY_LABEL: Record<Priority, string> = { high: "Regular", medium: "Occasional", low: "Exploring" };
const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Priority)}
      onClick={(e) => e.stopPropagation()}
      className="text-[11px] border border-neutral-200 rounded-md px-2 py-1 text-neutral-500 bg-white focus:outline-none focus:border-neutral-400 cursor-pointer"
    >
      <option value="high">Regular</option>
      <option value="medium">Occasional</option>
      <option value="low">Exploring</option>
    </select>
  );
}

const VENUE_TYPE_LABEL: Record<string, string> = {
  theatre: "Theatre",
  concert_hall: "Concert hall",
  arena: "Arena",
  gallery: "Gallery",
  pub: "Pub",
  outdoor: "Outdoor",
  other: "Other",
};

function capacityLabel(n: number): string {
  if (n < 200) return "Intimate";
  if (n < 600) return "Small";
  if (n < 1500) return "Medium";
  if (n < 5000) return "Large";
  return "Arena";
}

function EditVenueModal({ venue, onSave, onClose }: { venue: Venue; onSave: (updated: Venue) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: venue.name,
    description: venue.description ?? "",
    image_url: venue.image_url ?? "",
    website_url: venue.website_url ?? "",
    address: venue.address ?? "",
    neighbourhood: venue.neighbourhood ?? "",
  });
  const [saving, setSaving] = useState(false);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    setSaving(true);
    const updated = await api.updateVenue(venue.id, {
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      website_url: form.website_url.trim() || undefined,
      address: form.address.trim() || undefined,
      neighbourhood: form.neighbourhood.trim() || undefined,
    });
    onSave(updated);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-100">
          <span className="font-serif text-sm font-medium text-neutral-900">{venue.name}</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <IconX size={16} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {[
            { label: "Name", key: "name" as const, type: "input" },
            { label: "Image URL", key: "image_url" as const, type: "input" },
            { label: "Website URL", key: "website_url" as const, type: "input" },
            { label: "Address", key: "address" as const, type: "input" },
            { label: "Neighbourhood", key: "neighbourhood" as const, type: "input" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1 block">{label}</label>
              <input
                value={form[key]}
                onChange={field(key)}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={field("description")}
              rows={3}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-400 transition-colors resize-none"
            />
          </div>
          {form.image_url && (
            <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        <div className="px-5 pb-4 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:border-neutral-400 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <IconCheck size={12} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VenueRow({
  id,
  name,
  website_url,
  priority,
  editing,
  onPriorityChange,
  onEdit,
  address,
  neighbourhood,
  venue_type,
  capacity,
  description,
  image_url,
}: {
  id: string;
  name: string;
  website_url?: string;
  priority: Priority;
  editing: boolean;
  onPriorityChange: (id: string, p: Priority) => void;
  onEdit?: () => void;
  address?: string;
  neighbourhood?: string;
  venue_type?: string;
  capacity?: number;
  description?: string;
  image_url?: string;
}) {
  const meta = [
    venue_type ? (VENUE_TYPE_LABEL[venue_type] ?? venue_type) : null,
    neighbourhood ?? null,
    capacity ? `${capacityLabel(capacity)} · ${capacity.toLocaleString()}` : null,
  ].filter(Boolean).join(" · ");

  const editControls = editing && (
    <div className="flex items-center gap-2 flex-shrink-0">
      <PrioritySelect value={priority} onChange={(p) => onPriorityChange(id, p)} />
      {onEdit && (
        <button onClick={onEdit} className="text-neutral-300 hover:text-neutral-600 transition-colors" title="Edit venue">
          <IconPencil size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-[#f5f3ef] border-b border-[#ece7de] overflow-hidden hover:bg-white transition-colors flex">
      {image_url && (
        <div className="venue-img">
          <img src={image_url} alt={name} className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
        </div>
      )}
      <div className="px-4 py-3 flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {meta && <div className="text-[9px] font-bold tracking-widest text-[#e85d2f] uppercase mb-0.5">{meta}</div>}
            <span className="font-sans text-sm font-black uppercase tracking-tight text-[#1a1a1a]">{name}</span>
          </div>
          {editControls}
          {website_url && (
            <a href={website_url} target="_blank" rel="noopener noreferrer"
              className="text-[#d4c9b8] hover:text-[#e85d2f] transition-colors flex-shrink-0">
              <svg className="w-3 h-3" viewBox="0 0 6 10" fill="none">
                <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}
        </div>
        {description && (
          <ExpandableText text={description} className="text-[11px] text-[#888] mt-1.5 leading-relaxed" lines={2} />
        )}
      </div>
    </div>
  );
}

export default function VenueList() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("venues");
  const [editing, setEditing] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  useEffect(() => {
    Promise.all([api.getVenues(), api.getCompanies()]).then(([v, c]) => {
      setVenues(v); setCompanies(c); setLoading(false);
    });

    function onEditorChange() { setEditing(isEditor()); }
    onEditorChange();
    window.addEventListener("editor-change", onEditorChange);
    return () => window.removeEventListener("editor-change", onEditorChange);
  }, []);

  async function handleVenuePriority(id: string, priority: Priority) {
    const updated = await api.updateVenuePriority(id, priority);
    setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, priority: updated.priority } : v)));
  }

  async function handleCompanyPriority(id: string, priority: Priority) {
    const updated = await api.updateCompanyPriority(id, priority);
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, priority: updated.priority } : c)));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-neutral-300 text-sm tracking-widest uppercase">Loading…</div>;
  }

  const items = tab === "venues" ? venues : companies;
  const onPriorityChange = tab === "venues" ? handleVenuePriority : handleCompanyPriority;

  return (
    <div>
      {editingVenue && (
        <EditVenueModal
          venue={editingVenue}
          onSave={(updated) => {
            setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setEditingVenue(null);
          }}
          onClose={() => setEditingVenue(null)}
        />
      )}

      {/* Tab toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center border border-[#ece7de] overflow-hidden">
          {(["venues", "companies"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-4 py-1.5 capitalize transition-colors ${tab === t ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#ece7de]"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {editing && (
          <span className="text-[11px] uppercase tracking-widest text-neutral-400">editing</span>
        )}
      </div>

      {/* Groups */}
      {PRIORITY_ORDER.map((p) => {
        const group = items.filter((item) => item.priority === p);
        if (!group.length) return null;
        return (
          <div key={p} className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#e85d2f]">{PRIORITY_LABEL[p]}</span>
              <span className="text-[10px] text-[#bbb]">{group.length}</span>
              <div className="flex-1 h-px bg-[#ece7de]" />
            </div>
            <div className="flex flex-col">
              {group.map((item) => (
                <VenueRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  website_url={item.website_url ?? undefined}
                  priority={item.priority as Priority}
                  editing={editing}
                  onPriorityChange={onPriorityChange}
                  onEdit={tab === "venues" ? () => setEditingVenue(item as Venue) : undefined}
                  address={"address" in item ? (item as Venue).address ?? undefined : undefined}
                  neighbourhood={"neighbourhood" in item ? (item as Venue).neighbourhood ?? undefined : undefined}
                  venue_type={"venue_type" in item ? (item as Venue).venue_type ?? undefined : undefined}
                  capacity={"capacity" in item ? (item as Venue).capacity ?? undefined : undefined}
                  description={item.description ?? undefined}
                  image_url={item.image_url ?? undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
