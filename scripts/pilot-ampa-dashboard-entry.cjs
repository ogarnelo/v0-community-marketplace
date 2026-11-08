// Browser-only entry used by scripts/pilot-ampa-real-dashboard-chromium.cjs.
// This intentionally uses deterministic fictional school props.
const React=require("react");
const {createRoot}=require("react-dom/client");
const Dashboard=require("../components/admin/school-admin-dashboard.tsx").default;
const ids={
  ALFA:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  BETA:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  GAMMA:"dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};
const label=new URLSearchParams(location.search).get("school")||"ALFA";
if(!(label in ids))throw Error("Invalid fictional QA school");
const props={
 school:{id:ids[label],name:"COLEGIO QA "+label,city:"Ciudad QA",
  region:"Región QA",postal_code:"00000",school_type:"educativo"},
 listings:[{id:"11111111-1111-4111-8111-111111111111",
  title:"LIBRO QA "+label,school_id:ids[label],category:"libros",
  status:"available",created_at:new Date().toISOString()}],
 memberCount:1,
 schoolAdmins:[{id:"22222222-2222-4222-8222-222222222222",full_name:"ADMIN QA "+label}],
 reports:[],accessCodes:[{code:"QA-CODIGO-"+label,is_active:true,
  created_at:new Date().toISOString()}],
 listingViews:[],agreements:[],reportSubscription:null,
 currentUserEmail:"qa-"+label.toLowerCase()+"@example.invalid",reportDeliveries:[]
};
createRoot(document.getElementById("app")).render(React.createElement(Dashboard,props));
