import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTASection() {
  return (
    <section className="bg-primary py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
        <h2 className="text-balance text-3xl font-bold text-primary-foreground md:text-4xl">
          Empieza a ahorrar hoy
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/80">
          Unete a miles de familias que ya estan ahorrando y contribuyendo a un mundo mas sostenible. Es gratis, rapido y seguro.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/auth?mode=signup">
            <Button size="lg" variant="secondary" className="gap-2 px-8">
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth">
            <Button size="lg" variant="outline" className="border-primary-foreground/30 px-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              Iniciar sesion
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
