import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Leaf, PiggyBank, Repeat2, Users } from "lucide-react";

export const metadata = {
  title: 'Impacto educativo y circular',
  description: 'Wetudy impulsa ahorro familiar, reutilización y economía circular educativa.',
};

export default async function ImpactoPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);
  const stats = [
    { icon: PiggyBank, title: 'Ahorro familiar', text: 'Cada operación ayuda a reducir el coste de libros, uniformes y material escolar.' },
    { icon: Repeat2, title: 'Reutilización anual', text: 'El material educativo tiene ciclos naturales: quien termina un curso puede ayudar al siguiente.' },
    { icon: Leaf, title: 'Menos desperdicio', text: 'Alargar la vida útil del material reduce compras innecesarias y residuos.' },
    { icon: Users, title: 'Comunidad', text: 'Wetudy crea relaciones de confianza entre familias, estudiantes y negocios locales.' },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <section className="border-b bg-card"><div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8"><Badge variant="outline" className="mb-4">Impacto Wetudy</Badge><h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Reutilizar material educativo también es construir comunidad</h1><p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Wetudy convierte la segunda mano educativa en ahorro, sostenibilidad y acceso más justo.</p></div></section>
        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{stats.map((item)=><Card key={item.title}><CardContent className="p-6"><item.icon className="h-7 w-7 text-primary"/><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></CardContent></Card>)}</div></section>
      </main><Footer />
    </div>
  );
}
