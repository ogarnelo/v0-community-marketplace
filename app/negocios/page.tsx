import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Store, Upload, Users, TrendingUp, BadgeCheck, MessageCircle } from "lucide-react";

export const metadata = {
  title: 'Wetudy para negocios locales',
  description: 'Perfil profesional para librerías, academias y tiendas educativas que quieren vender dentro de comunidades educativas.',
};

const benefits = [
  { icon: Store, title: 'Perfil profesional', text: 'Catálogo, descripción, web, insignia de negocio y seguidores.' },
  { icon: Upload, title: 'Publicación rápida', text: 'Sube productos educativos con fotos, precio, ISBN y curso.' },
  { icon: Users, title: 'Seguidores reales', text: 'Los usuarios que siguen tu perfil reciben avisos de nuevos productos.' },
  { icon: TrendingUp, title: 'Boosts y visibilidad', text: 'Destaca productos clave en campañas de vuelta al cole.' },
  { icon: MessageCircle, title: 'Chat y ofertas', text: 'Habla con compradores, negocia y cierra ventas desde Wetudy.' },
  { icon: BadgeCheck, title: 'Confianza', text: 'Reputación, valoraciones y actividad profesional visible.' },
];

export default async function NegociosPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
            <div>
              <Badge variant="outline" className="mb-4">Para librerías, academias y tiendas</Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Vende productos educativos donde las familias ya buscan reutilizar</h1>
              <p className="mt-5 text-lg text-muted-foreground">Wetudy ayuda a negocios locales a ganar visibilidad en comunidades educativas sin montar una tienda online compleja.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild><Link href="/auth?mode=signup">Crear perfil profesional</Link></Button>
                <Button asChild variant="outline"><Link href="/marketplace">Ver marketplace</Link></Button>
              </div>
            </div>
            <div className="rounded-3xl border bg-muted/40 p-6">
              <h2 className="text-xl font-semibold">Ideal para vender</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>• libros nuevos y usados</li><li>• material escolar</li><li>• calculadoras y tecnología educativa</li><li>• packs de curso</li><li>• productos de academia</li>
              </ul>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((item) => <Card key={item.title}><CardContent className="p-6"><item.icon className="h-7 w-7 text-primary" /><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></CardContent></Card>)}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
