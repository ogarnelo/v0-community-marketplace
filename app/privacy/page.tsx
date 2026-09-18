import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3 mb-6">
          <Link href="/">Volver a Wetudy</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Privacidad</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última actualización: 18 de septiembre de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">Qué datos utiliza Wetudy</h2>
            <p className="mt-2">Para prestar el servicio podemos tratar datos de cuenta y perfil, publicaciones, conversaciones, acuerdos, valoraciones, reportes, búsquedas guardadas, solicitudes de centro y datos técnicos necesarios para seguridad y funcionamiento.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Ubicación y proximidad</h2>
            <p className="mt-2">Wetudy puede usar el código postal facilitado por el usuario para ofrecer una referencia de proximidad aproximada. No mostramos una ubicación exacta de domicilio en los anuncios.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Comunicaciones</h2>
            <p className="mt-2">Podemos enviar emails relacionados con la cuenta y con eventos del servicio, por ejemplo confirmación de registro, primeros mensajes, acuerdos, soporte o alertas de búsquedas guardadas cuando estén activadas.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Proveedores técnicos</h2>
            <p className="mt-2">Wetudy utiliza proveedores de infraestructura, base de datos, autenticación, protección contra abuso, analítica técnica y envío de email para operar el servicio. Estos proveedores reciben únicamente los datos necesarios para prestar sus funciones.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Tus opciones</h2>
            <p className="mt-2">Puedes actualizar los datos de tu perfil desde tu cuenta y contactar con soporte para consultas sobre tu información. Las búsquedas guardadas y sus avisos pueden gestionarse desde la cuenta.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Contacto</h2>
            <p className="mt-2">Para consultas de privacidad utiliza el formulario del <Link className="font-medium text-primary hover:underline" href="/help">centro de ayuda</Link>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
