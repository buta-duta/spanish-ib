import { execSync } from "node:child_process";

// Web uses window.location.origin for API calls; do not bake VERCEL_URL into the bundle.

execSync("pnpm exec expo export -p web", { stdio: "inherit", env: process.env });
