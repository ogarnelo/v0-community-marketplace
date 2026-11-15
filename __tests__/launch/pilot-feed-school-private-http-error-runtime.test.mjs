import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const paths=["app/api/marketplace/feed/route.ts","app/api/marketplace/my-school/route.ts"];
for (const file of paths){
  const code=readFileSync(file,"utf8");
  test(file+" never logs backend exceptions",()=>{
    assert.doesNotMatch(code,/console\.error\([^)]*,\s*(error|e|err)\s*\)/);
    assert.match(code,/console\.error\("marketplace_(?:feed_read_failed|school_feed_failed)"\)/);
  });
  test(file+" always returns private cache headers on validation errors",()=>{
    for(const text of ["Página incorrecta.","Página fuera de rango.","Filtros incorrectos."]){
      const location=code.indexOf(text);
      assert.ok(location>0,text);
      const body=code.slice(location,location+160);
      assert.match(body,/Cache-Control/);
      assert.match(body,/private, no-store/);
    }
  });
}
test("feed radius validation returns private 400",()=>{
  const src=readFileSync(paths[0],"utf8");
  const start=src.indexOf('Radio incorrecto.');
  assert.match(src.slice(start,start+160),/Cache-Control/);
});
test("school 401 and 503 are explicitly non-cacheable",()=>{
 const src=readFileSync(paths[1],"utf8");
 for(const message of ["Inicia sesión para ver tu colegio.","No se pudo determinar tu colegio."]){
  const start=src.indexOf(message);
  assert.ok(start>0);
  assert.match(src.slice(start,start+180),/private, no-store/);
 }
});
test("both API routes remain valid typescript",()=>{
 for(const file of paths){
  const r=ts.transpileModule(readFileSync(file,"utf8"),{fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 }
});
