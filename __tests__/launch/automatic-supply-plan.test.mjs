import test from "node:test";
import assert from "node:assert/strict";
import {planAutomaticSupply} from "../../lib/admin/automatic-supply-plan.mjs";
const opp=(key,extra={})=>({key,status:"new",familiesCount:2,supplyCount:0,demandUserIds:["buyer"],...extra});
const candidate=(userId,contactAllowed=true)=>({userId,contactAllowed});
test("skip covered and closed, deduplicate and revalidate",async()=>{
 const result=await planAutomaticSupply({
  load:async()=>[opp("closed",{status:"closed"}),opp("covered",{supplyCount:2}),opp("a"),opp("b")],
  candidates:async()=>({candidates:[candidate("buyer"),candidate("a"),candidate("a"),candidate("off",false),candidate("b"),candidate("c")]}),
  revalidate:async(o,ids)=>o.key==="a"?["a","forged"]:ids
 });
 assert.deepEqual(result.plan,[{key:"a",targets:["a"]},{key:"b",targets:["b","c"]}]);
});
test("failure aborts planning without a partial plan",async()=>{
 await assert.rejects(planAutomaticSupply({load:async()=>[opp("a")],candidates:async()=>{throw Error("read failed")},revalidate:async()=>[]}),/read failed/);
});
test("budget and malformed counts fail closed",async()=>{
 const result=await planAutomaticSupply({load:async()=>[opp("bad",{supplyCount:null}),opp("a"),opp("b")],candidates:async()=>({candidates:[candidate("x"),candidate("y")]}),revalidate:async(o,ids)=>ids},{maxTargets:1});
 assert.equal(result.targets,1);assert.equal(result.inspected,1);
 await assert.rejects(planAutomaticSupply({},{maxTargets:21}),/budget/);
});
