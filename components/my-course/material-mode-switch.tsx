import Link from "next/link"
import { GraduationCap, Search } from "lucide-react"

export function MaterialModeSwitch({
  active,
}: {
  active: "marketplace" | "course"
}) {
  return (
    <div className="inline-flex w-full rounded-xl border bg-muted/30 p-1 sm:w-auto" aria-label="Modo de búsqueda de material">
      <Link
        href="/marketplace"
        className={[
          "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition sm:flex-none",
          active === "marketplace"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <Search className="h-4 w-4" />
        Buscar material
      </Link>
      <Link
        href="/beta/mi-curso"
        className={[
          "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition sm:flex-none",
          active === "course"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <GraduationCap className="h-4 w-4" />
        Preparar mi curso
      </Link>
    </div>
  )
}
