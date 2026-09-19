import { Card, CardContent } from "@/components/ui/card"
import { Recycle, Heart, Euro, Users } from "lucide-react"

const metrics = [
  { icon: Recycle, value: "Reutiliza", label: "Da una segunda vida al material escolar", color: "text-secondary" },
  { icon: Heart, value: "Dona", label: "Ofrece material que otra familia puede necesitar", color: "text-primary" },
  { icon: Users, value: "Conecta", label: "Habla con familias de tu comunidad o zona", color: "text-secondary" },
  { icon: Euro, value: "Ahorra", label: "Acuerda precios y entregas directamente", color: "text-primary" },
]

export function ImpactSection() {
  return (
    <section className="bg-card py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
            Impacto desde el primer intercambio
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Cada artículo que se reutiliza puede reducir el gasto de una familia, alargar la vida útil del material escolar y evitar residuos innecesarios.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="border-border text-center">
              <CardContent className="p-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
