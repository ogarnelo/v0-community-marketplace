import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-mono text-lg font-bold text-foreground">Wetudy</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Marketplace educativo para ahorrar, reutilizar y dar más vida a libros, uniformes y material escolar.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Plataforma</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/marketplace" className="text-sm text-muted-foreground transition-colors hover:text-primary">Marketplace</Link></li>
              <li><Link href="/marketplace/new" className="text-sm text-muted-foreground transition-colors hover:text-primary">Publicar anuncio</Link></li>
              <li><Link href="/catalogo" className="text-sm text-muted-foreground transition-colors hover:text-primary">Catálogo educativo</Link></li>
              <li><Link href="/impacto" className="text-sm text-muted-foreground transition-colors hover:text-primary">Impacto social</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Para vender</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/negocios" className="text-sm text-muted-foreground transition-colors hover:text-primary">Para negocios locales</Link></li>
              <li><Link href="/marketplace/new" className="text-sm text-muted-foreground transition-colors hover:text-primary">Vender material</Link></li>
              <li><Link href="/seguridad" className="text-sm text-muted-foreground transition-colors hover:text-primary">Vender con confianza</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-primary">Hablar con Wetudy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Confianza</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/seguridad" className="text-sm text-muted-foreground transition-colors hover:text-primary">Seguridad</Link></li>
              <li><Link href="/legal/proteccion-comprador" className="text-sm text-muted-foreground transition-colors hover:text-primary">Protección comprador</Link></li>
              <li><Link href="/help" className="text-sm text-muted-foreground transition-colors hover:text-primary">Centro de ayuda</Link></li>
              <li><Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-primary">Contacto</Link></li>
              <li><Link href="/about" className="text-sm text-muted-foreground transition-colors hover:text-primary">Sobre Wetudy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="flex flex-col gap-2">
              <li><Link href="/legal/privacidad" className="text-sm text-muted-foreground transition-colors hover:text-primary">Privacidad</Link></li>
              <li><Link href="/legal/terminos" className="text-sm text-muted-foreground transition-colors hover:text-primary">Términos de uso</Link></li>
              <li><Link href="/legal/proteccion-comprador" className="text-sm text-muted-foreground transition-colors hover:text-primary">Protección comprador</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-sm text-muted-foreground">
            2026 Wetudy. Ahorro, reutilización y acceso educativo.
          </p>
        </div>
      </div>
    </footer>
  );
}
