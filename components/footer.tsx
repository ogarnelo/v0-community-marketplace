import Link from "next/link"
import { BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-mono text-lg font-bold text-foreground">Wetudy</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Compra, vende y dona material escolar en comunidad.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Usar Wetudy</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/marketplace" className="text-sm text-muted-foreground transition-colors hover:text-primary">Buscar material</Link></li>
              <li><Link href="/marketplace/new" className="text-sm text-muted-foreground transition-colors hover:text-primary">Publicar anuncio</Link></li>
              <li><Link href="/auth?mode=signup" className="text-sm text-muted-foreground transition-colors hover:text-primary">Crear cuenta</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Comunidad</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/onboarding/join-school" className="text-sm text-muted-foreground transition-colors hover:text-primary">Vincular mi centro</Link></li>
              <li><Link href="/register-school" className="text-sm text-muted-foreground transition-colors hover:text-primary">Solicitar alta de un centro</Link></li>
              <li><Link href="/help" className="text-sm text-muted-foreground transition-colors hover:text-primary">Centro de ayuda</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal y soporte</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-primary">Sobre Wetudy</Link></li>
              <li><Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-primary">Privacidad</Link></li>
              <li><Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-primary">Términos de uso</Link></li>
              <li><Link href="/legal/notificar-contenido" className="text-sm text-muted-foreground transition-colors hover:text-primary">Notificar contenido ilegal</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-sm text-muted-foreground">
            2026 Wetudy
          </p>
        </div>
      </div>
    </footer>
  )
}
