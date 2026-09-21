import Link from "next/link"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <Button asChild variant="ghost" className="-ml-3 mb-6">
          <Link href="/">Volver a Wetudy</Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">Términos de uso</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Última actualización: 21 de septiembre de 2026.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">1. Titularidad y contacto</h2>
            <p className="mt-2">
              La identificación legal completa del prestador se incorporará cuando
              quede definida la titularidad jurídica de Wetudy. El contacto
              operativo del servicio es{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:hola@wetudy.com"
              >
                hola@wetudy.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Qué ofrece Wetudy</h2>
            <p className="mt-2">
              Wetudy facilita que familias, estudiantes y comunidades educativas
              publiquen y encuentren libros, uniformes y otros materiales escolares,
              contacten por chat, registren acuerdos y utilicen herramientas de
              valoración, soporte y reporte.
            </p>
            <p className="mt-2">
              Wetudy actúa como servicio tecnológico de intermediación y no es parte
              compradora ni vendedora de los artículos publicados por los usuarios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Cuenta y acceso</h2>
            <p className="mt-2">
              Debes facilitar información razonablemente exacta, mantener el acceso
              a tu cuenta bajo tu control y no utilizar identidades ajenas. Podemos
              requerir verificación de email u otras medidas proporcionadas de
              seguridad para proteger la cuenta y el servicio.
            </p>
            <p className="mt-2">
              No debes compartir contraseñas ni intentar acceder a cuentas, datos o
              funciones para las que no tengas autorización.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Menores</h2>
            <p className="mt-2">
              Las cuentas de estudiante están destinadas a personas de 14 años o
              más. Las personas menores de 14 años no deben crear una cuenta propia
              y deberán utilizar el servicio a través de su familia o representante
              cuando corresponda. Los estudiantes menores de 18 años deben contar
              con supervisión o intervención familiar cuando resulte necesaria por
              la naturaleza del acuerdo.
            </p>
            <p className="mt-2">
              No se debe publicar información personal, imágenes o datos sensibles
              de otros menores que no sean necesarios para utilizar el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Resumen para estudiantes menores</h2>
            <p className="mt-2">
              Si tienes entre 14 y 17 años, utiliza Wetudy con estas reglas básicas:
              no compartas tu dirección, teléfono u otros datos personales
              innecesarios; no quedes a solas con desconocidos para entregar o
              recoger material; pide ayuda a tu familia o representante para
              cualquier acuerdo que implique dinero, una entrega presencial o una
              situación que te genere dudas; y utiliza las herramientas de reporte
              si alguien te incomoda o intenta llevar la conversación fuera del
              propósito de Wetudy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Publicaciones</h2>
            <p className="mt-2">
              Quien publica debe describir el artículo de forma razonablemente fiel,
              utilizar imágenes que pueda legítimamente publicar e indicar de forma
              clara los defectos o limitaciones relevantes que conozca.
            </p>
            <p className="mt-2">
              No se permite publicar contenido ilegal, fraudulento, engañoso,
              discriminatorio, acosador, que vulnere derechos de terceros, incluya
              datos personales innecesarios o utilice Wetudy para actividades ajenas
              al propósito comunitario del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Acuerdos entre usuarios</h2>
            <p className="mt-2 font-medium">
              La entrega y el pago se acuerdan directamente entre las partes.
            </p>
            <p className="mt-2">
              Wetudy no procesa actualmente el pago, no custodia dinero, no organiza
              el envío ni garantiza la entrega del artículo. Antes de confirmar un
              acuerdo, las partes deben revisar por sí mismas el artículo, precio,
              lugar de entrega y cualquier condición relevante.
            </p>
            <p className="mt-2">
              El registro de un acuerdo en Wetudy sirve como herramienta de
              coordinación e historial de la comunidad; no convierte a Wetudy en
              parte del contrato que puedan celebrar los usuarios entre sí.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">8. Uso particular y comunitario</h2>
            <p className="mt-2">
              En el lanzamiento actual Wetudy está destinado a particulares,
              familias, estudiantes y comunidades educativas que reutilizan material
              escolar de forma ocasional. No se permite utilizar el servicio como
              canal habitual de venta en el marco de una actividad empresarial o
              profesional. Wetudy podrá retirar publicaciones o limitar cuentas
              cuando detecte un uso profesional o comercial incompatible con este
              alcance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">9. Ordenación y búsqueda de anuncios</h2>
            <p className="mt-2">
              Por defecto, el marketplace muestra primero los anuncios más recientes.
              El usuario puede cambiar la ordenación utilizando criterios disponibles
              en la interfaz, como distancia aproximada, precio o diferencia respecto
              al precio original. Los filtros de búsqueda pueden limitar los
              resultados por categoría, curso, tipo de anuncio, estado, ISBN, precio
              u otros campos disponibles.
            </p>
            <p className="mt-2">
              Wetudy no ofrece actualmente posiciones de pago, anuncios patrocinados
              ni ventajas de clasificación compradas por quien publica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">10. Centros educativos y comunidad</h2>
            <p className="mt-2">
              La vinculación o alta de un centro sirve como referencia comunitaria y
              está sujeta a validación cuando corresponda. Ser administrador de un
              centro no otorga acceso general a conversaciones privadas, acuerdos
              individuales ni actividad individual de las familias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">11. Moderación y reportes</h2>
            <p className="mt-2">
              Los usuarios pueden reportar anuncios, conversaciones o incidencias.
              Wetudy podrá revisar contenido y, cuando sea necesario y
              proporcionado, limitar su visibilidad, retirarlo, restringir funciones
              o suspender cuentas para proteger la comunidad, hacer cumplir estos
              términos o atender obligaciones legales.
            </p>
            <p className="mt-2">
              Cuando Wetudy adopte una restricción sobre contenido o una cuenta por
              considerar que infringe la ley o estos términos, comunicará los
              motivos y las vías disponibles para solicitar revisión cuando la
              normativa aplicable lo exija y dispongamos de datos de contacto.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">12. Contenido presuntamente ilícito</h2>
            <p className="mt-2">
              Cualquier persona o entidad puede utilizar el{" "}
              <Link
                className="font-medium text-primary hover:underline"
                href="/legal/notificar-contenido"
              >
                canal electrónico de notificación de contenido presuntamente ilícito
              </Link>
              . La notificación debe identificar con precisión la ubicación del
              contenido y explicar por qué se considera ilícito, además de incluir la
              información requerida por la normativa aplicable.
            </p>
            <p className="mt-2">
              Wetudy revisará las notificaciones de forma diligente. El envío de una
              notificación no determina por sí solo que el contenido sea ilegal.
              También podemos adoptar medidas frente a notificaciones
              manifiestamente abusivas o repetitivas conforme a la normativa
              aplicable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">13. Propiedad intelectual</h2>
            <p className="mt-2">
              Conservas los derechos que te correspondan sobre los textos y
              fotografías que publiques. Al subirlos con el fin de utilizar Wetudy,
              autorizas de forma no exclusiva y durante el tiempo necesario su
              almacenamiento, reproducción técnica y visualización dentro del
              servicio para publicar el anuncio, facilitar su búsqueda y operar las
              funciones relacionadas.
            </p>
            <p className="mt-2">
              No publiques material sobre el que no tengas derechos o autorización
              suficiente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">14. Valoraciones y convivencia</h2>
            <p className="mt-2">
              Las valoraciones deben reflejar una experiencia real y expresarse de
              forma respetuosa. No está permitido manipular valoraciones, utilizar
              varias cuentas para alterar reputaciones, amenazar a otros usuarios o
              publicar datos personales como forma de presión.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">15. Suspensión y cierre de cuenta</h2>
            <p className="mt-2">
              Wetudy podrá limitar o suspender el acceso cuando existan indicios
              razonables de fraude, abuso, riesgos de seguridad, incumplimientos
              graves o reiterados, o cuando sea necesario cumplir una obligación
              legal. La medida debe guardar relación con el riesgo o incumplimiento
              detectado.
            </p>
            <p className="mt-2">
              Si quieres dejar de utilizar el servicio, puedes solicitar la
              eliminación de tu cuenta y de los datos que proceda suprimir a través
              de{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:hola@wetudy.com"
              >
                hola@wetudy.com
              </a>
              , sin perjuicio de la información que deba conservarse por seguridad,
              obligaciones legales o defensa de reclamaciones.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">16. Disponibilidad y cambios del servicio</h2>
            <p className="mt-2">
              Podemos corregir errores, mejorar funciones, modificar o retirar
              características y realizar tareas de mantenimiento. Intentaremos evitar
              interrupciones innecesarias y comunicar cambios relevantes cuando sea
              razonable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">17. Responsabilidad</h2>
            <p className="mt-2">
              Cada usuario responde de la información que publica, de su conducta y
              de los acuerdos que alcance con otras personas. Wetudy no puede
              garantizar por adelantado la identidad, disponibilidad, estado del
              artículo o cumplimiento de todos los usuarios.
            </p>
            <p className="mt-2">
              Nada en estos términos excluye o limita responsabilidades o derechos
              que no puedan excluirse o limitarse conforme a la ley. Wetudy seguirá
              siendo responsable de sus propias obligaciones legales como prestador
              del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">18. Privacidad</h2>
            <p className="mt-2">
              El tratamiento de datos personales se explica en la{" "}
              <Link className="font-medium text-primary hover:underline" href="/privacy">
                Política de privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">19. Ley aplicable</h2>
            <p className="mt-2">
              Estos términos se rigen por la legislación española, sin privar a los
              consumidores de las protecciones imperativas que les correspondan. Las
              controversias se someterán a los juzgados y tribunales que resulten
              competentes conforme a la normativa aplicable, incluidos los del
              domicilio del consumidor cuando la ley así lo establezca.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">20. Punto de contacto y cambios</h2>
            <p className="mt-2">
              El punto de contacto electrónico de Wetudy para usuarios y para
              comunicaciones relacionadas con el Reglamento de Servicios Digitales
              es{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:hola@wetudy.com"
              >
                hola@wetudy.com
              </a>
              . Se atienden comunicaciones en español y, cuando sea necesario,
              también en inglés.
            </p>
            <p className="mt-2">
              Podemos actualizar estos términos para reflejar cambios legales,
              técnicos o del servicio. Los cambios relevantes se comunicarán de
              forma adecuada antes de que produzcan efectos cuando resulte
              necesario.
            </p>
            <p className="mt-2">
              Para consultas utiliza el{" "}
              <Link className="font-medium text-primary hover:underline" href="/help">
                centro de ayuda
              </Link>{" "}
              o escribe a{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:hola@wetudy.com"
              >
                hola@wetudy.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
