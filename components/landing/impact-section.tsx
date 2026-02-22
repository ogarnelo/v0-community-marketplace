import { Card, CardContent } from "@/components/ui/card"
import { Recycle, Heart, Euro, Users } from "lucide-react"

const metrics = [
  { icon: Recycle, value: "2.500+", label: "Items reutilizados", color: "text-secondary" },
  { icon: Heart, value: "680+", label: "Donaciones completadas", color: "text-primary" },
  { icon: Users, value: "1.200+", label: "Familias activas", color: "text-secondary" },
  { icon: Euro, value: "45.000\u20AC", label: "Ahorrados en total", color: "text-primary" },
]

export function ImpactSection() {
  return (
    <section className="bg-card py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
            Nuestro impacto
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
            Juntos estamos construyendo una comunidad educativa mas sostenible y solidaria
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
