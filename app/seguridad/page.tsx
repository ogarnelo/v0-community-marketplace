import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ShieldCheck, CreditCard, MessageCircle, AlertTriangle, Star, Truck } from "lucide-react";

export const metadata = {
  title: 'Seguridad y protección',
  description: 'Cómo Wetudy protege compras, pagos, conversaciones y reputación en el marketplace educativo.',
};

const items = [
  { icon: CreditCard, title: 'Pago dentro de Wetudy', text: 'El pago dentro de la plataforma permite dejar historial, estado de operación e incidencias asociadas.' },
  { icon: MessageCircle, title: 'Chat con contexto', text: 'Las conversaciones quedan vinculadas al anuncio, oferta, pago y envío para evitar pérdidas de información.' },
  { icon: Star, title: 'Reputación visible', text: 'Valoraciones, ventas completadas e insignias ayudan a elegir vendedores fiables.' },
  { icon: Truck, title: 'Seguimiento de entrega', text: 'El envío puede gestionarse con tracking manual y queda visible para comprador y vendedor.' },
  { icon: AlertTriangle, title: 'Incidencias postventa', text: 'Si algo falla, las partes pueden abrir una incidencia desde la operación.' },
  { icon: ShieldCheck, title: 'Moderación básica', text: 'Reportes, soporte y trazabilidad reducen riesgo en las primeras operaciones.' },
];

export default async function SeguridadPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar {...navbarData} />
      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center lg:px-8">
            <Badge variant="outline" className="mb-4">Confianza Wetudy</Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Compra y vende material educativo con más contexto y confianza</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Wetudy combina comunidad educativa, pagos, chat, reputación e incidencias para que las operaciones sean más claras que en grupos de WhatsApp o compraventas improvisadas.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild><Link href="/marketplace">Explorar marketplace</Link></Button>
              <Button asChild variant="outline"><Link href="/legal/proteccion-comprador">Ver protección</Link></Button>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.title}><CardContent className="p-6"><item.icon className="h-7 w-7 text-primary" /><h2 className="mt-4 font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></CardContent></Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
