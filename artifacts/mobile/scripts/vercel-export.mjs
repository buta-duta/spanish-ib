import { execSync } from "node:child_process";

// Web uses window.location.origin for API calls; do not bake VERCEL_URL into the bundle.

try {
  execSync("pnpm exec expo export -p web", { stdio: "inherit", env: process.env });
} catch (err) {
  console.error("expo export failed:", err?.message ?? err);
  if (err?.stdout) console.error(String(err.stdout));
  if (err?.stderr) console.error(String(err.stderr));
  process.exit(1);
}
