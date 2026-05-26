import { execSync } from "node:child_process";

const domain =
  process.env.EXPO_PUBLIC_DOMAIN ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL;

if (domain) {
  process.env.EXPO_PUBLIC_DOMAIN = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  console.log(`EXPO_PUBLIC_DOMAIN=${process.env.EXPO_PUBLIC_DOMAIN}`);
}

execSync("pnpm exec expo export -p web", { stdio: "inherit", env: process.env });
