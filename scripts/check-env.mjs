#!/usr/bin/env node

const REQUIRED = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

const RECOMMENDED = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];

function status(name) {
  return process.env[name] && process.env[name].trim().length > 0;
}

const missingRequired = REQUIRED.filter((name) => !status(name));
const missingRecommended = RECOMMENDED.filter((name) => !status(name));

console.log("\nWetudy launch environment check\n");

for (const name of REQUIRED) {
  console.log(`${status(name) ? "✅" : "❌"} required     ${name}`);
}

for (const name of RECOMMENDED) {
  console.log(`${status(name) ? "✅" : "⚠️ "} recommended  ${name}`);
}

if (missingRecommended.length > 0) {
  console.log(`\n⚠️  Missing recommended variables: ${missingRecommended.join(", ")}`);
}

if (missingRequired.length > 0) {
  console.error(`\n❌ Missing required variables: ${missingRequired.join(", ")}`);
  process.exit(1);
}

console.log("\n✅ Required launch variables are present.\n");
