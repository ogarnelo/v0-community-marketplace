import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {SupplyOutreachConsent} from "@/components/account/supply-outreach-consent";
export const dynamic="force-dynamic";
export default async function SupplyOutreachPage(){
  const db=await createClient(),{data,error}=await db.auth.getUser();
  if(error||!data?.user)redirect("/auth?next=/account/supply-outreach");
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
    <Link href="/account" className="underline text-sm">Volver a mi cuenta</Link>
    <h1 className="text-2xl font-semibold">Permiso para avisos de demanda</h1><SupplyOutreachConsent/>
  </main>;
}
