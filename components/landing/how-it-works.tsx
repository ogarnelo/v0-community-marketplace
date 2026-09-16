import { Card, CardContent } from "@/components/ui/card"
import { UserPlus, Search, Handshake } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crea tu cuenta",
    description: "Regístrate como familia o estudiante, añade tu zona y, si quieres, vincula tu colegio como filtro de confianza.",
  },
  {
    icon: Search,
    step: "02",
    title: "Busca o publica material",
    description: "Publica libros, uniformes o material escolar con foto, precio o donación, curso y estado del producto.",
  },
  {
    icon: Handshake,
    step: "03",
    title: "Contacta y acuerda",
    description: "Usa el chat para resolver dudas y confirmar el acuerdo. La entrega y el pago se acuerdan directamente entre las partes.",
  },
]

export function HowItWorks() {
  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
            Cómo funciona
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Un flujo simple para lanzar rápido: publicar, encontrar, contactar y acordar.
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
