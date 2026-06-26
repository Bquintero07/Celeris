import { execSync } from "child_process";
import { readdirSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config();

const DB = process.env.DIRECT_URL;
if (!DB) { console.error("DIRECT_URL not set in .env"); process.exit(1); }

const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: { ...process.env } });

console.log("Dropping schema...");
run(`psql "${DB}" -c "DROP SCHEMA public CASCADE"`);
run(`psql "${DB}" -c "CREATE SCHEMA public"`);

console.log("Applying migrations...");
const dir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

for (const file of files) {
  console.log(`  ${file}`);
  run(`psql "${DB}" -f "${resolve(dir, file)}"`);
}

console.log("Done. Run: pnpm seed");
