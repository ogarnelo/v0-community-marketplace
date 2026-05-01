import Link from "next/link"
import { BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-mono text-foreground">Wetudy</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Marketplace escolar comunitario. Ahorro, sostenibilidad y comunidad educativa.
            </p>
          </div>

          {/* Plataforma */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Plataforma</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/marketplace" className="text-sm text-muted-foreground hover:text-primary transition-colors">Marketplace</Link></li>
              <li><Link href="/auth?mode=signup" className="text-sm text-muted-foreground hover:text-primary transition-colors">Crear cuenta</Link></li>
              <li><Link href="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">Iniciar sesion</Link></li>
            </ul>
          </div>

          {/* Centros */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Centros</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/negocios" className="text-sm text-muted-foreground hover:text-primary transition-colors">Para negocios</Link></li>
              <li><Link href="/catalogo" className="text-sm text-muted-foreground hover:text-primary transition-colors">Catálogo educativo</Link></li>
              <li><Link href="/impacto" className="text-sm text-muted-foreground hover:text-primary transition-colors">Impacto</Link></li>
            </ul>
          </div>

          {/* Wetudy */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Wetudy</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/help" className="text-sm text-muted-foreground hover:text-primary transition-colors">Centro de ayuda</Link></li>
              <li><Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Sobre Wetudy</Link></li>
              <li><Link href="/seguridad" className="text-sm text-muted-foreground hover:text-primary transition-colors">Seguridad</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/legal/privacidad" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacidad</Link></li>
              <li><Link href="/legal/terminos" className="text-sm text-muted-foreground hover:text-primary transition-colors">Términos de uso</Link></li>
              <li><Link href="/legal/proteccion-comprador" className="text-sm text-muted-foreground hover:text-primary transition-colors">Protección comprador</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-sm text-muted-foreground">
            2026 Wetudy. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
