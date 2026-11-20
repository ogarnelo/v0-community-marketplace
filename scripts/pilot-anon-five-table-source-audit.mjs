#!/usr/bin/env node
/**
 * WETUDY #787: offline first-party source-call inventory, not runtime proof.
 * Include SELECT and writes (UPDATE/UPSERT may need SELECT privileges).
 * The --check mode fails on added/removed/changed clients, forcing review.
 * No environment variables, credentials, network calls, or database queries.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const ts = createRequire(import.meta.url)("typescript");

const roots = ["app","components","lib","hooks","contexts","providers",
               "utils","services","src"];
const names = ["agreements","demand_requests","profiles","saved_searches","schools"];
const manifest = "docs/pilot/ANON_FIVE_TABLE_SOURCE_READER_BASELINE.json";
const codeSuffix = /\.(?:[cm]?js|jsx|tsx?)$/;
const restLiteral = /\/rest\/v1\/(agreements|demand_requests|profiles|saved_searches|schools)(?![a-z_])/g;

function filesIn(dir) {
  try {
    return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
      if(entry.name.startsWith(".") ||
         ["node_modules",".next","dist","build","coverage"].includes(entry.name))
        return [];
      const path=join(dir,entry.name);
      return entry.isDirectory()?filesIn(path):
        entry.isFile()&&codeSuffix.test(entry.name)?[path]:[];
    });
  } catch(error) {
    if(error.code==="ENOENT")return [];
    throw error;
  }
}
function buildInventory() {
  const readers=[],dynamic=[];
  for(const file of roots.flatMap(filesIn).sort()) {
    const source=readFileSync(file,"utf8");
    const path=relative(".",file).replaceAll("\\","/");
    const syntax=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
    const counts=new Map();
    const visit=(node)=>{
      if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)
         &&node.expression.name.text==="from") {
        const receiver=node.expression.expression;
        const builtin=ts.isIdentifier(receiver)&&
          ["Array","Buffer","Promise","Set","Object"].includes(receiver.text);
        if(!builtin) {
          const argument=node.arguments[0];
          if(argument&&ts.isStringLiteralLike(argument)){
            if(names.includes(argument.text))
              counts.set(argument.text,(counts.get(argument.text)||0)+1);
          } else {
            dynamic.push({path,argument:argument?
              argument.getText(syntax).slice(0,72):"<missing argument>"});
          }
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(syntax);
    restLiteral.lastIndex=0;
    for(const item of source.matchAll(restLiteral))
      counts.set(item[1],(counts.get(item[1])||0)+1);
    for(const [table,calls] of [...counts].sort((a,b)=>a[0].localeCompare(b[0])))
      readers.push({path,table,calls});
  }
  dynamic.sort((a,b)=>a.path.localeCompare(b.path)||a.argument.localeCompare(b.argument));
  return {schema_version:1,targets:names,readers,dynamic_from:dynamic};
}

const mode=process.argv[2];
if(!["--inventory","--check"].includes(mode)||process.argv.length!==3)
  throw Error("Run with --inventory or --check; both are offline and read-only");
const actual=buildInventory();
if(mode==="--inventory"){
  console.log("WETUDY_FIVE_TABLE_INVENTORY_START");
  console.log(JSON.stringify(actual,null,2));
  console.log("WETUDY_FIVE_TABLE_INVENTORY_END");
  console.log("Source reader paths",new Set(actual.readers.map(x=>x.path)).size,
    "direct literal calls",actual.readers.reduce((n,x)=>n+x.calls,0),
    "unclassified .from(variable) calls",actual.dynamic_from.length);
}else{
  const expected=JSON.parse(readFileSync(manifest,"utf8"));
  try {assert.deepEqual(actual,expected);}catch(error){
    const e=new Set(expected.readers.map(x=>x.path+"|"+x.table+"|"+x.calls));
    const a=new Set(actual.readers.map(x=>x.path+"|"+x.table+"|"+x.calls));
    console.error("Added or changed clients",[...a].filter(x=>!e.has(x)).join("; "));
    console.error("Removed or changed clients",[...e].filter(x=>!a.has(x)).join("; "));
    console.error("Dynamic .from(...) baseline drift must also be reviewed.");
    throw error;
  }
  console.log("PASS: five-table first-party source inventory matches reviewed baseline",
    actual.readers.length,"file/table pairs");
}
