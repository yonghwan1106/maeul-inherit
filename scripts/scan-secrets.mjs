// Secret scan (spec 10-1): tracked files must contain no Anthropic key pattern, and
// .env* / .vercel/ must not be tracked. Prints only file:line locations, never matched values.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });

const files = git("ls-files", "-z").split("\0").filter(Boolean);
const problems = [];

for (const f of files) {
  if (/(^|\/)\.env/.test(f)) problems.push(`${f}: .env file is tracked`);
  if (/(^|\/)\.vercel\//.test(f)) problems.push(`${f}: .vercel/ is tracked`);
}

// Pattern assembled at runtime so this file itself never matches.
const KEY_RE = new RegExp(["sk", "ant", "[A-Za-z0-9]"].join("-"));
const SERVICE_KEY_RE = /serviceKey=[A-Za-z0-9%+/=]{20,}/;

for (const f of files) {
  if (/\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|mp4)$/i.test(f)) continue;
  let text;
  try { text = readFileSync(path.join(root, f), "utf8"); } catch { continue; }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (KEY_RE.test(line)) problems.push(`${f}:${i + 1}: Anthropic key pattern`);
    if (SERVICE_KEY_RE.test(line)) problems.push(`${f}:${i + 1}: data.go.kr serviceKey pattern`);
  });
}

if (problems.length) {
  console.error(`scan:secrets FAILED (${problems.length})`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`scan:secrets OK — ${files.length} tracked files, 0 findings`);
