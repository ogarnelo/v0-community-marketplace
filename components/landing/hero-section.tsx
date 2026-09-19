import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Leaf, Users, MapPin } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-card pb-14 pt-8 sm:pt-12 lg:pb-24 lg:pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-secondary/5" />
      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1 text-sm border-primary/20 text-primary bg-primary/5">
            <Leaf className="h-3.5 w-3.5" />
            Punto de encuentro para material escolar
          </Badge>

          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Compra, vende y dona material escolar en{" "}
            <span className="text-primary">comunidad</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Wetudy reúne a familias y estudiantes de una misma comunidad para ahorrar en cada curso y dar una segunda vida a libros, uniformes y material escolar.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/auth?mode=signup">
              <Button size="lg" className="gap-2 px-8">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" size="lg" className="px-8">
                Explorar material
              </Button>
            </Link>
          </div>

          <div className="mx-auto mt-10 grid max-w-sm gap-5 text-sm text-muted-foreground sm:mt-12 sm:max-w-none sm:grid-cols-3 sm:gap-8">
            <div className="grid grid-cols-[2.5rem_1fr] items-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Comunidad</p>
                <p className="text-xs">familias y centros</p>
              </div>
            </div>
            <div className="grid grid-cols-[2.5rem_1fr] items-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                <Leaf className="h-5 w-5 text-secondary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Reutilización</p>
                <p className="text-xs">menos gasto y residuos</p>
              </div>
            </div>
            <div className="grid grid-cols-[2.5rem_1fr] items-center gap-3 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Proximidad</p>
                <p className="text-xs">colegio, zona o provincia</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
