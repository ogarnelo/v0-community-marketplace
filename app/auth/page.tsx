import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { BookOpen } from "lucide-react"
import Link from "next/link"

export default function AuthPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden flex-1 flex-col justify-between bg-primary p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/20">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-primary-foreground font-mono">Wetudy</span>
        </Link>

        <div>
          <h2 className="text-balance text-3xl font-bold text-primary-foreground">
            La vuelta al cole no tiene que ser cara
          </h2>
          <p className="mt-3 max-w-md text-primary-foreground/70 leading-relaxed">
            Unete a tu comunidad educativa y empieza a comprar, vender y donar material escolar de forma facil y segura.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/50">
          2026 Wetudy. Todos los derechos reservados.
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center bg-card p-6 lg:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-mono text-foreground">Wetudy</span>
            </Link>
          </div>
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
