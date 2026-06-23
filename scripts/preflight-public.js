"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", "coverage"]);
const forbiddenExtensions = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".wmv", ".m4v"]);
const forbiddenNames = new Set([
  ".env",
  ".env.local",
  ".clip_reviews.json",
  ".progression.json",
  "store.json",
  "admin_password.txt",
]);
const forbiddenContent = [
  { name: "chemin local clips", regex: /D:\\\\CLIP BEST OF|D:\\CLIP BEST OF/i },
  { name: "code admin réel", regex: /ADMIN-[A-Z0-9]{5,}-[A-Z0-9]{5,}/ },
  { name: "code ami réel", regex: /AMI-[A-Z0-9]{5,}-[A-Z0-9]{5,}/ },
  { name: "code créateur réel", regex: /CREATEUR-[A-Z0-9]{5,}-[A-Z0-9]{5,}/ },
];

const failures = [];

walk(root);

if (failures.length) {
  console.error("Préflight public échoué. Ces fichiers ne doivent pas partir sur GitHub :");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Préflight public OK : aucun fichier vidéo, secret ou état privé détecté.");

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath) || entry.name;
    if (entry.isDirectory()) {
      if (["data", "clips", "videos", "media", "LIKE", ".analyse_cache"].includes(entry.name)) {
        failures.push(`${relative}/`);
        continue;
      }
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (forbiddenExtensions.has(path.extname(lower))) failures.push(relative);
    if (forbiddenNames.has(lower)) failures.push(relative);
    inspectContent(fullPath, relative);
  }
}

function inspectContent(fullPath, relative) {
  if (relative.replace(/\\/g, "/") === "scripts/preflight-public.js") return;
  const stat = fs.statSync(fullPath);
  if (stat.size > 1024 * 1024) return;
  let text = "";
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (_) {
    return;
  }
  for (const rule of forbiddenContent) {
    if (rule.regex.test(text)) failures.push(`${relative} (${rule.name})`);
  }
}
