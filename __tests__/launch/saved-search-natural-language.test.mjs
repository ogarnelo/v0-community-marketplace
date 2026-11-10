import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync("lib/marketplace/saved-search-matching.ts", "utf8");
const savedRoute = readFileSync("app/api/marketplace/saved-searches/route.ts", "utf8");
const compiled=ts.transpileModule(source,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}
).outputText;
const exports={};
runInNewContext(compiled,{ exports });
const {savedSearchMatchesListing,hasMeaningfulSearchTerms}=exports;
const listing=(title,rest={})=>({
  id:"test",title,description:null,category:"Libros",grade_level:"ESO",
  school_id:null,...rest,
});
const matches=(query,item)=>savedSearchMatchesListing({id:"s",query},item);

test("Spanish natural language is matched across word order, accents and simple plurals",()=>{
  assert.equal(matches("Busco libros de matemáticas de tercero de la ESO",
    listing("Libro de Matemáticas 3º ESO")),true);
  assert.equal(matches("Necesito un polo azul de uniforme de talla 12",
    listing("Uniforme Polo talla 12 azul", {category:"Uniformes"})),true);
  assert.equal(matches("Mochila azul ruedas",
    listing("Mochila con ruedas color azul", {category:"Mochilas"})),true);
  assert.equal(matches("Quiero un libro de matematicas de 3º ESO",
    listing("Matemáticas 3 ESO Libro")),true);
});

test("all meaningful terms remain necessary; no broad accidental alerts",()=>{
  assert.equal(matches("Polo azul talla 12",
    listing("Polo rojo talla 12", {category:"Uniformes"})),false);
  assert.equal(matches("Mochila con ruedas",
    listing("Mochila sin ruedas", {category:"Mochilas"})),false);
  assert.equal(matches("Matemáticas 3 ESO",
    listing("Matemáticas 2 ESO")),false);
  assert.equal(matches("sol", listing("Consola portátil")),false,
    "Partial words must not trigger arbitrary unrelated results");
  assert.equal(matches("Necesito una",listing("Necesito una mochila")),false,
    "Stop-word-only queries must not match everything");
  assert.equal(hasMeaningfulSearchTerms("Necesito una"),false);
  assert.equal(hasMeaningfulSearchTerms("Busco un polo azul"),true);
});

test("category, grade, radius, school and ISBN remain exact independent gates",()=>{
  const book=listing("Libro matemáticas tercero ESO",{
    isbn:"9788411111111",category:"Libros",grade_level:"ESO",
    directory_school_code:"04001234",
  });
  assert.equal(savedSearchMatchesListing({id:"s",query:"matematicas tercero",
    category:"Libros",grade_level:"ESO"},book),true);
  assert.equal(savedSearchMatchesListing({id:"s",query:"matematicas tercero",
    category:"Uniformes"},book),false);
  assert.equal(savedSearchMatchesListing({id:"s",query:"matematicas tercero",
    isbn_query:"9788499999999"},book),false);
  assert.equal(savedSearchMatchesListing({id:"s",query:"matematicas tercero",
    only_my_community:true,directory_school_code:"28009999"},book),false);
  assert.equal(savedSearchMatchesListing({id:"s",query:"matematicas tercero",
    radius_km:10},book,11),false);
});

test("a descriptive need narrows a saved category even without a typed search query",()=>{
  assert.match(savedRoute,/hasMeaningfulSearchTerms\(query\)/);
  assert.match(savedRoute,/!isbnQuery && hasMeaningfulSearchTerms\(needDetails\)/);
  assert.match(savedRoute,/needDetails\?\.slice\(0, 160\)/);
  assert.match(savedRoute,/!matchingQuery && !isbnQuery && !category && !gradeLevel/);
  assert.match(savedRoute,/query: matchingQuery/);
  assert.doesNotMatch(savedRoute,/!isbnQuery && !category && !gradeLevel \?/);
  assert.equal(matches("Polo azul talla 12",
    listing("Polo rojo talla 12",{category:"Uniformes"})),false);
});
