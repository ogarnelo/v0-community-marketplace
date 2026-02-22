import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Leaf, Users, PiggyBank } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-card pb-16 pt-20 lg:pb-24 lg:pt-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-secondary/5" />
      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1 text-sm border-primary/20 text-primary bg-primary/5">
            <Leaf className="h-3.5 w-3.5" />
            Marketplace escolar comunitario
          </Badge>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Ahorra, reutiliza y fortalece tu{" "}
            <span className="text-primary">comunidad educativa</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Compra, vende y dona material escolar dentro de tu colegio. Reduce el gasto de la vuelta al cole, fomenta la sostenibilidad y conecta con otras familias.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/auth?mode=signup">
              <Button size="lg" className="gap-2 px-8">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth">
              <Button variant="outline" size="lg" className="px-8">
                Iniciar sesion
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">65% ahorro</p>
                <p className="text-xs">de media por familia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                <Leaf className="h-5 w-5 text-secondary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">+2.500 items</p>
                <p className="text-xs">reutilizados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">120 centros</p>
                <p className="text-xs">conectados</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
