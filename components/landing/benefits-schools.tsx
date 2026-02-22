import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Heart, Users, Settings } from "lucide-react"

const benefits = [
  {
    icon: Heart,
    title: "Gestiona donaciones",
    description: "Controla y asigna donaciones de forma justa a traves del panel de administracion del centro.",
  },
  {
    icon: Users,
    title: "Fortalece la comunidad",
    description: "Conecta a las familias del centro, crea lazos y fomenta la colaboracion entre todos.",
  },
  {
    icon: BarChart3,
    title: "Metricas de impacto",
    description: "Visualiza el impacto: items reutilizados, donaciones, familias activas y euros ahorrados.",
  },
  {
    icon: Settings,
    title: "Facil de administrar",
    description: "Panel intuitivo para moderar anuncios, gestionar usuarios y monitorizar la actividad.",
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
              Beneficios para AMPAs y colegios
            </h2>
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              Wetudy ofrece a los centros educativos herramientas para gestionar donaciones, moderar contenidos y medir el impacto social.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
