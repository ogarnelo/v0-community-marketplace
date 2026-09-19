import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Leaf, School, Users } from "lucide-react"

const benefits = [
  {
    icon: School,
    title: "Participa en el marketplace",
    description:
      "El colegio o AMPA puede publicar material para venta o donación, buscar anuncios y contactar con otras personas de la comunidad.",
  },
  {
    icon: Users,
    title: "Activa tu comunidad",
    description:
      "Comparte el enlace, QR o código del centro para que familias y estudiantes se vinculen y encuentren material con más contexto y confianza.",
  },
  {
    icon: BarChart3,
    title: "Seguimiento de acuerdos",
    description:
      "Consulta anuncios, acuerdos confirmados, ventas, donaciones, visitas e incidencias asociadas a la comunidad del centro.",
  },
  {
    icon: Leaf,
    title: "Reportes e impacto",
    description:
      "Exporta informes PDF y CSV, programa reportes mensuales y consulta métricas de reutilización, valor circular y CO₂e potencialmente evitado.",
  },
]

export function BenefitsSchools() {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="border-border transition-shadow duration-200 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <benefit.icon className="h-5 w-5 text-secondary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{benefit.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
              Para colegios y AMPAs
            </h2>
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              Wetudy tiene la misión de ayudar a ordenar intercambios y donaciones de material escolar, fomentando la sostenibilidad, la comunicación y el acceso a recursos en comunidad.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
