import { Card, CardContent } from "@/components/ui/card"
import { PiggyBank, ShieldCheck, MessageCircle, Star } from "lucide-react"

const benefits = [
  {
    icon: PiggyBank,
    title: "Ahorro flexible",
    description: "Encuentra material escolar de segunda mano, donaciones o anuncios con precio claro para reducir el gasto de cada curso. En libros de texto, comprar de segunda mano puede suponer un ahorro de entre el 50% y el 70% frente a comprarlos nuevos.",
  },
  {
    icon: ShieldCheck,
    title: "Comunidad como filtro de confianza",
    description: "Puedes priorizar la búsqueda directamente en tu comunidad (colegio) o buscar a tu alrededor sin limitar el alcance.",
  },
  {
    icon: MessageCircle,
    title: "Contacto directo por chat",
    description: "Pregunta, acuerda detalles y cierra tu acuerdo con seguridad a través de un chat con historial y registro de transacción.",
  },
  {
    icon: Star,
    title: "Historial y valoraciones",
    description: "Tras un acuerdo confirmado, las partes pueden valorar la experiencia o reportar una incidencia en caso de que sea necesario.",
  },
]

export function BenefitsFamilies() {
  return (
    <section className="bg-card py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
              Beneficios para familias
            </h2>
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              Wetudy empieza con lo esencial: publicar, encontrar, contactar y acordar material escolar de forma sencilla.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="border-border transition-shadow duration-200 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{benefit.description}</p>
                  {benefit.title === "Ahorro flexible" ? (
                    <a
                      href="https://www.telemadrid.es/programas/madrid-directo/Los-libros-de-segunda-mano-una-opcion-para-ahorrar-hasta-un-70-en-la-vuelta-al-cole-2-2919928014--20260826075825.html"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
                    >
                      Fuente: Telemadrid, 2026
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
