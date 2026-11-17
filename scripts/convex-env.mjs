// Copies AI keys from the old Mimir env files and role keys from .keys/ into
// the linked Convex deployment. Prints variable names only, never values.
// Run after `npx convex dev` has linked the new deployment:  node scripts/convex-env.mjs [--prod]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GH = join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Documents", "GitHub");
const SOURCES = [join(GH, "mimir-solana", ".env.local"), join(GH, "mimir-desk", ".env"), join(GH, "mimir-solana-devnet", ".env.local")];
const WANT = [
  "GEMINI_API_KEY", "GEMINI_API_KEYS", "GEMINI_MODELS",
  "GROQ_API_KEY", "GROQ_API_KEYS", "GROQ_MODEL",
  "TOKEN_HARBOR_API_KEY", "TOKEN_HARBOR_BASE_URL", "TOKEN_HARBOR_MODEL",
  "PANDASCORE_TOKEN",
];

function parse(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {};
for (const f of SOURCES) if (existsSync(f)) for (const [k, v] of Object.entries(parse(f))) if (WANT.includes(k) && v && !env[k]) env[k] = v;
// Token Harbor keys in mimir-desk may use OPENAI_* names.
const desk = join(GH, "mimir-desk", ".env");
if (existsSync(desk)) {
  const d = parse(desk);
  env.TOKEN_HARBOR_API_KEY ??= d.TOKEN_HARBOR_API_KEY ?? d.OPENAI_API_KEY;
  env.TOKEN_HARBOR_BASE_URL ??= d.TOKEN_HARBOR_BASE_URL ?? d.OPENAI_BASE_URL;
}

for (const role of ["creator", "oracle", "auditor", "crank"]) {
  const p = join(".keys", `${role}.json`);
  if (existsSync(p)) env[`${role.toUpperCase()}_SECRET`] = readFileSync(p, "utf8").trim();
}
const adminPath = process.env.ADMIN_KEYPAIR ?? join(process.env.USERPROFILE ?? "", ".config", "solana", "talos-deploy.json");
if (existsSync(adminPath) && process.argv.includes("--with-admin")) env.ADMIN_SECRET = readFileSync(adminPath, "utf8").trim();

const prod = process.argv.includes("--prod") ? ["--prod"] : [];
for (const [k, v] of Object.entries(env)) {
  if (!v) continue;
  execFileSync("npx", ["convex", "env", "set", ...prod, k, v], { stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" });
  console.log(`set ${k}`);
}
console.log("done. Unset KONDORA_BACKEND_OFF (or set it to 0) when the chain side is ready.");
