// Strips backend-only fields from public/data/shows.json before the Astro build.
// Only runs when PUBLIC_STATIC_DATA=true (CI/static builds). Safe to skip locally.
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Allow running directly (e.g. from publish.sh) or as part of a static CI build
const isStaticBuild = process.env.PUBLIC_STATIC_DATA === "true";
const isDirect = process.argv[1]?.endsWith("strip-shows.mjs") && !process.env.npm_lifecycle_event;
if (!isStaticBuild && !isDirect) {
  console.log("strip-shows: skipping (not a static build)");
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, "../public/data/shows.json");

const STRIP = new Set(["description", "embedding", "source_id", "scraped_at", "end_time"]);

const raw = JSON.parse(readFileSync(path, "utf-8"));
const before = JSON.stringify(raw).length;

const stripped = raw.map((s) => {
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (!STRIP.has(k)) out[k] = v;
  }
  return out;
});

writeFileSync(path, JSON.stringify(stripped));
const after = JSON.stringify(stripped).length;
console.log(`strip-shows: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (saved ${((before-after)/1024).toFixed(0)}KB)`);
