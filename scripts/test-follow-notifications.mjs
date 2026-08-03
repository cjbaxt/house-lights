/**
 * Integration test: follow / unfollow / notification flow
 *
 * Tests the Alice → Bob follow cycle end-to-end against the real Supabase DB.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-follow-notifications.mjs
 *
 * The script uses two existing test users identified by username.
 * Set ALICE and BOB env vars to override (defaults: claireheaded, testuser1).
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createClient } = require(path.resolve(__dirname, "../frontend/node_modules/@supabase/supabase-js/dist/index.cjs"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALICE_USERNAME = process.env.ALICE ?? "claireheaded";
const BOB_USERNAME = process.env.BOB ?? "testuser1";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

let passed = 0;
let failed = 0;

function ok(label, value) {
  if (value) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function getProfile(username) {
  const { data } = await db.from("profile").select("id, username").eq("username", username).single();
  return data;
}

async function getFollowing(userId) {
  const { data } = await db.from("friendship").select("friend_id").eq("user_id", userId);
  return (data ?? []).map(r => r.friend_id);
}

async function getFollowers(userId) {
  const { data } = await db.from("friendship").select("user_id").eq("friend_id", userId);
  return (data ?? []).map(r => r.user_id);
}

async function getNotification(userId, actorId) {
  const { data } = await db.from("notification")
    .select("id, read, created_at")
    .eq("user_id", userId)
    .eq("actor_id", actorId)
    .eq("type", "follow")
    .maybeSingle();
  return data;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

console.log(`\nResolving users: ${ALICE_USERNAME} and ${BOB_USERNAME}…`);
const alice = await getProfile(ALICE_USERNAME);
const bob = await getProfile(BOB_USERNAME);

if (!alice) { console.error(`User "${ALICE_USERNAME}" not found`); process.exit(1); }
if (!bob) { console.error(`User "${BOB_USERNAME}" not found`); process.exit(1); }
console.log(`  Alice = ${alice.username}`);
console.log(`  Bob   = ${bob.username}\n`);

// Clean up any existing state so tests are idempotent
await db.from("friendship").delete().eq("user_id", alice.id).eq("friend_id", bob.id);
await db.from("notification").delete().eq("user_id", bob.id).eq("actor_id", alice.id).eq("type", "follow");

// ─── Test 1: Alice follows Bob ──────────────────────────────────────────────

console.log("Test 1: Alice follows Bob");
await db.from("friendship").upsert({ user_id: alice.id, friend_id: bob.id });
await db.from("notification").upsert(
  { user_id: bob.id, actor_id: alice.id, type: "follow", read: false, created_at: new Date().toISOString() },
  { onConflict: "user_id,actor_id,type" }
);

const following1 = await getFollowing(alice.id);
const followers1 = await getFollowers(bob.id);
const notif1 = await getNotification(bob.id, alice.id);

ok("Alice is in Bob's followers list", followers1.includes(alice.id));
ok("Bob is in Alice's following list", following1.includes(bob.id));
ok("Bob has a follow notification from Alice", !!notif1);
ok("Notification is unread", notif1?.read === false);

// ─── Test 2: Bob marks notification read ────────────────────────────────────

console.log("\nTest 2: Bob reads the notification");
await db.from("notification").update({ read: true }).eq("id", notif1.id);
const notif2 = await getNotification(bob.id, alice.id);
ok("Notification is now read", notif2?.read === true);

// ─── Test 3: Alice unfollows Bob ────────────────────────────────────────────

console.log("\nTest 3: Alice unfollows Bob");
await db.from("friendship").delete().eq("user_id", alice.id).eq("friend_id", bob.id);
await db.from("notification").delete().eq("user_id", bob.id).eq("actor_id", alice.id).eq("type", "follow");

const following3 = await getFollowing(alice.id);
const followers3 = await getFollowers(bob.id);
const notif3 = await getNotification(bob.id, alice.id);

ok("Bob is removed from Alice's following list", !following3.includes(bob.id));
ok("Alice is removed from Bob's followers list", !followers3.includes(alice.id));
ok("Notification is deleted on unfollow", notif3 === null);

// ─── Test 4: Alice re-follows Bob ───────────────────────────────────────────

console.log("\nTest 4: Alice re-follows Bob");
await db.from("friendship").upsert({ user_id: alice.id, friend_id: bob.id });
await db.from("notification").upsert(
  { user_id: bob.id, actor_id: alice.id, type: "follow", read: false, created_at: new Date().toISOString() },
  { onConflict: "user_id,actor_id,type" }
);

const following4 = await getFollowing(alice.id);
const notif4 = await getNotification(bob.id, alice.id);

ok("Bob is back in Alice's following list", following4.includes(bob.id));
ok("Bob gets a fresh unread notification", notif4?.read === false);
ok("Notification has a fresh timestamp", notif4 && new Date(notif4.created_at) > new Date(notif1.created_at));

// ─── Teardown ───────────────────────────────────────────────────────────────

await db.from("friendship").delete().eq("user_id", alice.id).eq("friend_id", bob.id);
await db.from("notification").delete().eq("user_id", bob.id).eq("actor_id", alice.id).eq("type", "follow");

// ─── Summary ────────────────────────────────────────────────────────────────

const total = passed + failed;
process.stdout.write(`\n${total} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
