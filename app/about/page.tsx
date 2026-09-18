import Link from "next/link";
import JsonLd from "@/components/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildBreadcrumbJsonLd } from "@/lib/seo/structured-data";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { createClient } from "@/lib/supabase/server";
import { getNavbarData } from "@/lib/navbar/get-navbar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Recycle,
  Users,
  BarChart3,
  ShoppingBag,
  ArrowRight,
  Handshake,
  School,
} from "lucide-react";

export const metadata = buildPublicMetadata({
  title: "Sobre Wetudy y la reutilización de material escolar",
  description: "Conoce Wetudy: una comunidad para publicar, encontrar y reutilizar libros, uniformes y material escolar entre familias.",
  path: "/about",
});

const missionValues = [
  {
    icon: Heart,
    title: "Accesibilidad",
    description:
      "Facilitamos que las familias encuentren material escolar reutilizable, donaciones y anuncios con precios claros.",
  },
  {
    icon: Recycle,
    title: "Sostenibilidad",
    description:
      "Alargamos la vida útil de libros, mochilas, uniformes y otros materiales que todavía pueden seguir utilizándose.",
  },
  {
    icon: Users,
    title: "Comunidad",
    description:
      "Conectamos familias y estudiantes y permitimos priorizar el colegio, la zona o la provincia como referencia de proximidad.",
  },
  {
    icon: Handshake,
    title: "Acuerdos directos",
    description:
      "Wetudy facilita el contacto, el chat y el historial. La entrega y el pago se acuerdan directamente entre las partes.",
  },
];

const howSteps = [
  {
    step: "01",
    title: "Crea tu cuenta",
    description:
      "Regístrate, añade tu zona y, si quieres, vincula tu colegio como filtro de confianza.",
  },
  {
    step: "02",
    title: "Publica o busca material",
    description:
      "Publica lo que ya no necesitas o encuentra libros, uniformes, mochilas y otro material escolar.",
  },
  {
    step: "03",
    title: "Contacta y acuerda",
    description:
      "Usa el chat para resolver dudas y dejar constancia del acuerdo entre las partes.",
  },
  {
    step: "04",
    title: "Confirma y valora",
    description:
      "Cuando ambas partes confirman el acuerdo, pueden valorar la experiencia o reportar un problema si hace falta.",
  },
];

export default async function AboutPage() {
  const supabase = await createClient();
  const navbarData = await getNavbarData(supabase);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Wetudy", path: "/" },
    { name: "Sobre Wetudy", path: "/about" },
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={breadcrumbJsonLd} />
      <Navbar
        isLoggedIn={navbarData.isLoggedIn}
        userName={navbarData.userName}
        isAdmin={navbarData.isAdmin}
        isSuperAdmin={navbarData.isSuperAdmin}
        adminHref={navbarData.adminHref}
        unreadMessagesCount={navbarData.unreadMessagesCount}
        unreadNotificationsCount={navbarData.unreadNotificationsCount}
        notifications={navbarData.notifications}
        currentUserId={navbarData.currentUserId}
      />
      <main className="flex-1">
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              Sobre Wetudy
            </Badge>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Un punto de encuentro para reutilizar material escolar
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Wetudy nace para que el material escolar en buen estado pueda encontrar una segunda vida y para facilitar el contacto entre familias que buscan, venden o donan.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth?mode=signup">
                <Button size="lg" className="gap-2">
                  Únete ahora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Explorar marketplace
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Nuestra misión
              </h2>
              <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                Empezamos por un flujo sencillo: publicar, encontrar, contactar, acordar y confirmar.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {missionValues.map((val) => (
                <Card key={val.title} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <val.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                      {val.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {val.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/50 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Cómo funciona
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Cuatro pasos para gestionar un acuerdo de material escolar con claridad.
              </p>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {howSteps.map((s) => (
                <div key={s.step} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 lg:px-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Qué aprendemos durante el MVP
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
                Medimos uso real para entender qué materiales faltan y dónde podemos mejorar la experiencia.
              </p>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <BarChart3 className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="mt-3 font-semibold text-foreground">Actividad real</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Observamos anuncios, contactos y acuerdos para entender el recorrido del usuario.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <School className="mx-auto h-8 w-8 text-primary" />
                  <h3 className="mt-3 font-semibold text-foreground">Necesidades por comunidad</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Las búsquedas guardadas ayudan a detectar demanda por categoría, curso y comunidad.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border text-center">
                <CardContent className="p-6">
                  <Recycle className="mx-auto h-8 w-8 text-secondary" />
                  <h3 className="mt-3 font-semibold text-foreground">Reutilización</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Seguimos qué materiales encuentran una nueva oportunidad antes de ampliar el producto.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-primary/5 py-16 lg:py-20">
          <div className="mx-auto max-w-2xl px-4 text-center lg:px-8">
            <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl">
              Forma parte del lanzamiento
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Únete a Wetudy para buscar, publicar y reutilizar material escolar con otras familias.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth?mode=signup">
                <Button size="lg">Crear cuenta gratis</Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" size="lg">
                  Ver marketplace
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
