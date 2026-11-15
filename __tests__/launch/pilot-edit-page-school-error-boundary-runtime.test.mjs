import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const route="app/marketplace/edit/[id]/page.tsx";
const uid="11111111-1111-4111-8111-111111111111";
const lid="22222222-2222-4222-8222-222222222222";
const listing={id:lid,title:"Libro sintético",seller_id:uid,school_id:lid,
  directory_school_code:null,status:"available"};
function fixture({fail=null,owner=true,directory=false,user=true}={}){
 const calls=[];
 const row={...listing,seller_id:owner?uid:"someone-else",
  directory_school_code:directory?"12345678":null};
 const from=role=>table=>{
  calls.push(role+":"+table);
  const answer=()=>{
   let data=table==="listings"?row:table==="schools"?{name:"Colegio sintético",city:"Ciudad sintética"}:
     table==="listing_photos"?[]:table==="school_directory"?{name:"Centro directorio",municipality:"Ciudad"}:null;
   return {data,error:table===fail?{message:"PRIVATE_SQL_BACKEND_DETAILS"}:null};
  };
  const q=new Proxy({}, {get(_t,method){
   if(method==="then")return(resolve,reject)=>Promise.resolve(answer()).then(resolve,reject);
   if(method==="maybeSingle")return async()=>answer();
   return()=>q;
  }});
  return q;
 };
 const supabase={auth:{getUser:async()=>({data:{user:user?{id:uid}:null}})},from:from("user")};
 const mocks={
  "next/navigation":{notFound:()=>{throw Error("NOT_FOUND")},redirect:()=>{throw Error("REDIRECT")}},
  "@/lib/supabase/server":{createClient:async()=>{calls.push("CREATE_CLIENT");return supabase}},
  "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN_CREATED");return {from:from("admin")}}},
  "@/components/marketplace/edit-listing-form":{default:()=>null},
  "react/jsx-runtime":{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
 };
 const transpiled=ts.transpileModule(readFileSync(route,"utf8"),{fileName:route,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,
    esModuleInterop:true}});
 assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exported={};
 vm.runInNewContext(transpiled.outputText,{exports:exported,
   require:id=>mocks[id]??{},Promise,Date,URL,console},{filename:route,timeout:1500});
 return{run:id=>exported.default({params:Promise.resolve({id})}),calls};
}
test("malformed ID returns notFound before creating a Supabase client",async()=>{
 const f=fixture();
 await assert.rejects(f.run("not-a-uuid"),e=>e.message==="NOT_FOUND");
 assert.deepEqual(f.calls,[]);
});
const routeText=readFileSync(route,"utf8");
test("listing loading never throws raw backend error objects",()=>{
 assert.match(routeText,/if \(listingError\) throw new Error\("listing_edit_load_failed"\)/);
 assert.doesNotMatch(routeText,/if \(listingError\) throw listingError/);
});
test("ownership check always precedes school and privileged directory reads",()=>{
 const owner=routeText.indexOf("if (typedListing.seller_id !== user.id)");
 const school=routeText.indexOf('.from("schools")');
 const directory=routeText.indexOf('.from("school_directory")');
 assert.ok(owner>0&&school>owner&&directory>owner);
});
test("school and photographs errors abort before constructing the editor",()=>{
 assert.match(routeText,/data: school, error: schoolError/);
 assert.match(routeText,/data: photos, error: photosError/);
 assert.match(routeText,/if \(schoolError \|\| photosError\) throw new Error\("listing_edit_related_data_unavailable"\)/);
});
test("school directory lookup error is not mistaken for an unassigned school",()=>{
 assert.match(routeText,/data: directorySchool, error: directoryError/);
 assert.match(routeText,/if \(directoryError\) throw new Error\("listing_edit_school_directory_unavailable"\)/);
});
test("directory admin lookup requires a directory code from the owned listing",()=>{
 const owned=routeText.indexOf("if (typedListing.seller_id !== user.id)");
 const directory=routeText.indexOf('typedListing.directory_school_code\n    ? await createAdminClient()');
 assert.ok(owned>=0&&directory>owned);
});
test("empty school and directory are legitimate null results",()=>{
 assert.match(routeText,/Promise.resolve\(\{ data: null, error: null \}\)/);
 assert.match(routeText,/: \{ data: null, error: null \}/);
 assert.match(routeText,/: "Centro no asignado"/);
});
test("editor route TypeScript/JSX compiles cleanly",()=>{
 const compiled=ts.transpileModule(routeText,{fileName:route,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
