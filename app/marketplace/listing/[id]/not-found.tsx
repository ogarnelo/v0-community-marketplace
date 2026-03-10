import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Anuncio no encontrado</h1>
      <p className="mt-2 text-muted-foreground">
        Este anuncio ya no está disponible.
      </p>
      <Link href="/marketplace" className="mt-6">
        <Button>Volver al marketplace</Button>
      </Link>
    </div>
  )
}