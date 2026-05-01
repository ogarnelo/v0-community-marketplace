import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Mail, HelpCircle, ShieldAlert } from "lucide-react";
export const metadata = { title: 'Contacto y soporte' };
export default async function ContactPage() { const supabase = await createClient(); const navbarData = await getNavbarData(supabase); return <div className="flex min-h-screen flex-col"><Navbar {...navbarData}/><main className="mx-auto max-w-4xl flex-1 px-4 py-10"><h1 className="text-3xl font-bold">Contacto y soporte</h1><p className="mt-2 text-muted-foreground">Canales rápidos para incidencias, dudas y colaboración.</p><div className="mt-8 grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><Mail className="h-6 w-6 text-primary"/><h2 className="mt-3 font-semibold">Soporte</h2><p className="mt-2 text-sm text-muted-foreground">support@wetudy.com</p></CardContent></Card><Card><CardContent className="p-5"><ShieldAlert className="h-6 w-6 text-primary"/><h2 className="mt-3 font-semibold">Incidencias</h2><p className="mt-2 text-sm text-muted-foreground">Abre una incidencia desde la operación pagada.</p></CardContent></Card><Card><CardContent className="p-5"><HelpCircle className="h-6 w-6 text-primary"/><h2 className="mt-3 font-semibold">Ayuda</h2><p className="mt-2 text-sm text-muted-foreground"><Link href="/help" className="text-primary hover:underline">Centro de ayuda</Link></p></CardContent></Card></div></main><Footer/></div> }
