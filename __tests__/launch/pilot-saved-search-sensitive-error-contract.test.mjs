import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file="app/api/marketplace/listings/match-saved-searches/route.ts";
const source=readFileSync(file,"utf8");
test("saved search matching has only fixed diagnostic log tokens",()=>{
  const lines=source.split("\n").filter(line=>/console\.(error|warn)\(/.test(line));
  assert.equal(lines.length,3,"Review every new sensitive logging site");
  for(const line of lines){
    assert.match(line,/console\.error\("marketplace_(need_attribution_failed|saved_search_email_failed|saved_search_matching_failed)"\)/);
    assert.doesNotMatch(line,/\b(error|emailError|needError)\b[^"]*\)/);
  }
});
test("top-level matching error returns a fixed private response with no backend message",()=>{
  const handler=source.slice(source.lastIndexOf("  } catch {"));
  assert.match(handler,/console\.error\("marketplace_saved_search_matching_failed"\)/);
  assert.match(handler,/return NextResponse\.json\(\{ error: "No se pudieron generar los avisos\." \}/);
  assert.match(handler,/status: 500, headers: \{ "Cache-Control": "private, no-store" \}/);
  assert.doesNotMatch(handler,/error\?\.message|error\.message|console\.error\([^)]*,/);
});

test("malformed listing UUID is rejected before the privileged matcher lookup",()=>{
  const validation=source.indexOf("UUID is the real public.listings.id type");
  const admin=source.indexOf("const admin = createAdminClient()");
  assert.ok(validation>=0 && validation<admin);
  assert.match(source,/error: "Anuncio no válido\."/);
});
