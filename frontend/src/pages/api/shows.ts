import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, locals }) => {
  const p = url.searchParams;

  const cityId    = p.get("city_id");
  const types     = p.get("types")?.split(",").filter(Boolean) ?? [];
  const venueIds  = p.get("venue_ids")?.split(",").filter(Boolean) ?? [];
  const fromDate  = p.get("from_date") ?? new Date().toISOString().split("T")[0];
  const toDate    = p.get("to_date");
  const page      = Math.max(0, parseInt(p.get("page") ?? "0", 10));
  const limit     = Math.min(1000, Math.max(1, parseInt(p.get("limit") ?? "20", 10)));

  let query = locals.supabase
    .from("show")
    .select(
      "id,title,subtitle,venue_id,company_id,city_id,date,time,type,url,ticket_status,price_from,currency,description,summary,image_url",
      { count: "exact" }
    )
    .gte("date", fromDate)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (cityId)           query = query.eq("city_id", cityId);
  if (types.length)     query = query.in("type", types);
  if (toDate)           query = query.lte("date", toDate);

  // Exclude venues the user has hidden — only when no explicit venue filter is active
  if (!venueIds.length && locals.user) {
    const { data: hiddenVenues } = await locals.supabase
      .from("user_venue")
      .select("venue_id")
      .eq("user_id", locals.user.id)
      .eq("hidden", true);
    const hiddenIds = (hiddenVenues ?? []).map((r: { venue_id: string }) => r.venue_id);
    if (hiddenIds.length) query = query.not("venue_id", "in", `(${hiddenIds.join(",")})`);
  }

  if (venueIds.length)  query = query.in("venue_id", venueIds);

  const { data, error, count } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ shows: data ?? [], total: count ?? 0, page, limit }), {
    headers: { "Content-Type": "application/json" },
  });
};
