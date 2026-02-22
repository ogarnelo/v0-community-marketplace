import { Card, CardContent } from "@/components/ui/card"
import { UserPlus, Search, Handshake } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Registrate y unete a tu centro",
    description: "Crea tu cuenta gratuita e introduce el codigo de tu colegio, instituto o universidad para unirte a la comunidad.",
  },
  {
    icon: Search,
    step: "02",
    title: "Explora o publica material",
    description: "Busca libros, uniformes y material escolar de segunda mano, o publica lo que ya no necesitas para venderlo o donarlo.",
  },
  {
    icon: Handshake,
    step: "03",
    title: "Conecta y completa",
    description: "Contacta directamente con otras familias a traves del chat, acuerda el intercambio y dejad una valoracion mutua.",
  },
]

export function HowItWorks() {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
            Como funciona
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            En tres sencillos pasos estaras ahorrando y contribuyendo a un mundo mas sostenible
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.step} className="relative border-border bg-card transition-shadow duration-200 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-4xl font-bold text-muted-foreground/20 font-mono">{step.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
