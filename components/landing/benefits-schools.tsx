import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Heart, Users, Settings } from "lucide-react"

const benefits = [
  {
    icon: Heart,
    title: "Donaciones visibles",
    description: "Las familias pueden publicar material para donar y dejar constancia del acuerdo por chat.",
  },
  {
    icon: Users,
    title: "Comunidad educativa",
    description: "El colegio ayuda como referencia de confianza, pero la búsqueda también puede abrirse por zona o provincia.",
  },
  {
    icon: BarChart3,
    title: "Aprendizaje del lanzamiento",
    description: "Primero medimos uso real: anuncios, contactos, acuerdos y necesidades de las familias.",
  },
  {
    icon: Settings,
    title: "Moderación básica",
    description: "Reportes y revisión manual para mantener una experiencia segura durante el MVP.",
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
              Wetudy puede ayudar a ordenar intercambios y donaciones de material escolar sin depender de grupos de WhatsApp o anuncios en papel.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
