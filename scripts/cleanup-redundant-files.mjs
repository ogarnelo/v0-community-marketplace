import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const filesToDelete = [
  "lib/marketplace-formatters.ts",
  "lib/mock-data.ts",
  "components/marketplace/listing-view-tracker.tsx",
  "components/marketplace/post-publish-share.tsx",
  "components/marketplace/related-listings.tsx",
  "app/api/listings/saved-searches/create/route.ts",
  "app/api/listings/saved-searches/delete/route.ts",
];

for (const file of filesToDelete) {
  const path = join(process.cwd(), file);
  if (existsSync(path)) {
    rmSync(path, { force: true });
    console.log(`deleted ${file}`);
  } else {
    console.log(`skipped ${file}`);
  }
}

console.log("Duplicate/deprecated file cleanup complete.");
