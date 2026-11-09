// Local CI browser bundle: actual QR onboarding page + actual @supabase/ssr
// browser client; the compact auth screen is a QA sign-in/up adapter ONLY.
const React=require("react");
const {createRoot}=require("react-dom/client");
const JoinSchoolPage=require("../app/onboarding/join-school/page.tsx").default;
const {createClient}=require("../lib/supabase/client.ts");
const {getSafeInternalPath}=require("../lib/auth/safe-next.ts");

const supabase=createClient();
const actions={navigation:[],analytics:[],tracks:[]};
const router={
 push:(path)=>actions.navigation.push(["push",path]),
 replace:(path)=>actions.navigation.push(["replace",path]),
 refresh:()=>{actions.refresh=(actions.refresh||0)+1}
};
window.__qa={supabase,actions,router};
function AuthAdapter(){
 const params=new URLSearchParams(window.location.search);
 const mode=params.get("mode")==="signup"?"signup":"login";
 const next=getSafeInternalPath(params.get("next"))||"/onboarding/join-school";
 const [message,setMessage]=React.useState("");
 async function submit(e){
  e.preventDefault();
  const email=e.currentTarget.elements.namedItem("email").value;
  const password=e.currentTarget.elements.namedItem("password").value;
  const result=mode==="signup"
    ?await supabase.auth.signUp({email,password,options:{data:{user_type:"parent"}}})
    :await supabase.auth.signInWithPassword({email,password});
  if(result.error){setMessage(result.error.message);return;}
  // No email is sent in local Supabase CI. Real hosted signups still require
  // email verification; this is NOT a production AuthForm/browser test.
  window.location.assign(next);
 }
 return React.createElement("main",{"data-testid":"local-qa-auth"},
  React.createElement("h1",null,mode==="signup"?"QA creación local":"QA acceso local"),
  React.createElement("form",{onSubmit:submit},
   React.createElement("input",{name:"email","aria-label":"Correo",type:"email",required:true}),
   React.createElement("input",{name:"password","aria-label":"Contraseña",type:"password",required:true}),
   React.createElement("button",{type:"submit"},mode==="signup"?"Crear QA":"Entrar QA")),
  React.createElement("span",{role:"alert"},message));
}
window.__qa.signOut=async()=>supabase.auth.signOut();
const app=window.location.pathname==="/auth"
 ?React.createElement(AuthAdapter)
 :React.createElement(JoinSchoolPage);
createRoot(document.getElementById("root")).render(app);
