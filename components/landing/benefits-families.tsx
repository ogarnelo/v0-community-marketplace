import { Card, CardContent } from "@/components/ui/card"
import { PiggyBank, ShieldCheck, MessageCircle, Star } from "lucide-react"

const benefits = [
  {
    icon: PiggyBank,
    title: "Ahorra hasta un 70%",
    description: "Compra material escolar de segunda mano a precios mucho mas bajos que en tienda. Cada euro cuenta.",
  },
  {
    icon: ShieldCheck,
    title: "Comunidad de confianza",
    description: "Solo interactuas con familias de tu propio centro. Conoces a la persona que hay detras de cada anuncio.",
  },
  {
    icon: MessageCircle,
    title: "Comunicacion directa",
    description: "Chat integrado para que puedas preguntar, negociar y coordinar la entrega sin salir de la app.",
  },
  {
    icon: Star,
    title: "Valoraciones verificadas",
    description: "El sistema de ratings te ayuda a identificar a los mejores miembros de la comunidad.",
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
              Wetudy nacio para hacer la vuelta al cole mas facil y asequible para todas las familias.
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
