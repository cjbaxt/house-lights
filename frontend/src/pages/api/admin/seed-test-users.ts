import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "clairejb93@gmail.com";

export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.email !== ADMIN_EMAIL)
    return new Response("Forbidden", { status: 403 });

  const admin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const log: string[] = [];

  // Create three test users via auth admin API
  const testUsers = [
    { email: "bob@houselights.test", username: "bob", display_name: "Bob" },
    { email: "charlie@houselights.test", username: "charlie", display_name: "Charlie" },
    { email: "dana@houselights.test", username: "dana", display_name: "Dana" },
  ];

  const uids: Record<string, string> = {};

  for (const u of testUsers) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: "testpassword123",
      email_confirm: true,
    });
    if (error && !error.message.includes("already registered")) {
      log.push(`Error creating ${u.username}: ${error.message}`);
      continue;
    }
    const uid = data?.user?.id ?? (await admin.from("profile").select("id").eq("username", u.username).single()).data?.id;
    if (!uid) { log.push(`Could not resolve uid for ${u.username}`); continue; }
    uids[u.username] = uid;

    await admin.from("profile").upsert({ id: uid, username: u.username, display_name: u.display_name, username_confirmed: true }, { onConflict: "id" });
    log.push(`${u.display_name}: ${uid}`);
  }

  // Find admin user ID
  const { data: adminProfile } = await admin.from("profile").select("id").eq("username", (
    await admin.from("profile").select("id, username").eq("id",
      (await admin.auth.admin.listUsers()).data.users.find(u => u.email === ADMIN_EMAIL)?.id ?? ""
    ).single()
  ).data?.id ?? "").single();

  const adminUser = (await admin.auth.admin.listUsers()).data.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) return new Response(JSON.stringify({ log, error: "Admin user not found" }), { status: 500 });
  const adminId = adminUser.id;
  log.push(`Admin: ${adminId}`);

  // Friendships
  for (const uid of Object.values(uids)) {
    await admin.from("friendship").upsert({ user_id: adminId, friend_id: uid }, { onConflict: "user_id,friend_id" });
  }
  log.push("Friendships created");

  // Pick shows
  const { data: lbtShows } = await admin.from("show").select("id, title, date").ilike("title", "%little big things%").order("date").limit(5);
  const { data: alokShows } = await admin.from("show").select("id, title, date").ilike("title", "%alok%").order("date").limit(3);
  const { data: otherShows } = await admin.from("show").select("id, title, date").not("title", "ilike", "%little big things%").not("title", "ilike", "%alok%").order("date").limit(3);

  log.push(`LBT: ${lbtShows?.length ?? 0}, Alok: ${alokShows?.length ?? 0}, Other: ${otherShows?.length ?? 0}`);

  const inserts: { user_id: string; show_id: string; status: string }[] = [];

  // Bob: interested in first 3 LBT dates + first 2 Alok
  for (const s of (lbtShows ?? []).slice(0, 3))
    inserts.push({ user_id: uids.bob, show_id: s.id, status: "interested" });
  for (const s of (alokShows ?? []).slice(0, 2))
    inserts.push({ user_id: uids.bob, show_id: s.id, status: "interested" });

  // Charlie: tickets_bought on first LBT, interested on second
  if (lbtShows?.[0]) inserts.push({ user_id: uids.charlie, show_id: lbtShows[0].id, status: "tickets_bought" });
  if (lbtShows?.[1]) inserts.push({ user_id: uids.charlie, show_id: lbtShows[1].id, status: "interested" });

  // Dana: first Alok (overlaps with Bob) + 2 unique other shows
  if (alokShows?.[0]) inserts.push({ user_id: uids.dana, show_id: alokShows[0].id, status: "interested" });
  for (const s of (otherShows ?? []).slice(0, 2))
    inserts.push({ user_id: uids.dana, show_id: s.id, status: "interested" });

  if (inserts.length > 0) {
    const { error } = await admin.from("watchlist").upsert(inserts, { onConflict: "user_id,show_id" });
    if (error) log.push(`Watchlist error: ${error.message}`);
    else log.push(`Inserted ${inserts.length} watchlist entries`);
  }

  return new Response(JSON.stringify({ ok: true, log }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
