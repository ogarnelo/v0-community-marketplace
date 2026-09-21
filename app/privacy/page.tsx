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
        <p className="mt-3 text-sm text-muted-foreground">
          Última actualización: 22 de septiembre de 2026.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">Responsable y contacto</h2>
            <p className="mt-2">
              La identificación legal completa del responsable del tratamiento se
              incorporará cuando quede definida la titularidad jurídica de Wetudy.
              Para cualquier consulta o ejercicio de derechos puedes escribir a{" "}
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
            <h2 className="text-lg font-semibold">Qué datos tratamos</h2>
            <p className="mt-2">
              Según cómo utilices Wetudy podemos tratar datos de cuenta y perfil
              (por ejemplo, nombre, email, tipo de usuario, curso, código postal y
              vinculación con un centro), publicaciones y fotografías, búsquedas
              guardadas, conversaciones, acuerdos, valoraciones, reportes,
              solicitudes de centros, consultas de soporte y notificaciones de
              contenido presuntamente ilícito.
            </p>
            <p className="mt-2">
              También tratamos datos técnicos y de uso necesarios para seguridad,
              prevención de abuso, mantenimiento y medición del servicio, como
              información del navegador, páginas visitadas, señales técnicas de
              protección frente a automatismos y, cuando llegas mediante un enlace
              etiquetado o una referencia externa, la fuente, medio o campaña de
              adquisición y el host de referencia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Para qué usamos los datos y base jurídica</h2>
            <div className="mt-2 space-y-3">
              <p>
                <strong>Prestación del servicio.</strong> Gestionamos la cuenta,
                publicaciones, chat, acuerdos, búsquedas guardadas, vinculación con
                centros, soporte y demás funciones solicitadas para ejecutar la
                relación con el usuario y las medidas previas que este solicite.
              </p>
              <p>
                <strong>Seguridad y moderación.</strong> Podemos prevenir fraude,
                spam, accesos abusivos, incumplimientos y riesgos para la comunidad
                sobre la base de nuestro interés legítimo en mantener un servicio
                seguro y, cuando proceda, del cumplimiento de obligaciones legales.
              </p>
              <p>
                <strong>Cumplimiento legal.</strong> Tratamos reportes,
                notificaciones de contenido presuntamente ilícito, solicitudes de
                autoridades y la información necesaria para cumplir obligaciones
                legales o atender y defender reclamaciones.
              </p>
              <p>
                <strong>Comunicaciones del servicio.</strong> Podemos enviar emails
                necesarios para registro, seguridad, mensajes, acuerdos, soporte,
                alertas que hayas activado y funcionamiento de tu cuenta. Wetudy no
                utiliza actualmente estos datos para publicidad comercial
                personalizada. Si en el futuro se incorporan comunicaciones
                comerciales opcionales, se solicitará la base jurídica que resulte
                aplicable de forma separada.
              </p>
              <p>
                <strong>Mejora, analítica y atribución.</strong> Utilizamos medición
                agregada y una atribución limitada de adquisición para entender qué
                canales generan visitas, altas, publicaciones y acuerdos y mejorar
                Wetudy, sobre la base del interés legítimo en medir y desarrollar el
                servicio. Esta atribución no almacena la dirección IP ni un
                identificador publicitario propio y no utiliza cookies publicitarias.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Ubicación y proximidad</h2>
            <p className="mt-2">
              Wetudy puede utilizar el código postal facilitado por el usuario para
              ofrecer referencias aproximadas de proximidad y filtros del
              marketplace. No mostramos la dirección exacta del domicilio de una
              persona en los anuncios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Centros educativos</h2>
            <p className="mt-2">
              La vinculación con un centro permite organizar la comunidad y generar
              métricas agregadas. Los perfiles de administración de centro reciben
              información agregada y operativa de su centro; no se les facilita el
              contenido de conversaciones privadas, acuerdos individuales ni una
              relación de actividad individual de las familias por el mero hecho de
              ser administradores del centro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Proveedores y destinatarios</h2>
            <p className="mt-2">
              Para operar Wetudy utilizamos proveedores que actúan como encargados o
              subencargados en las funciones que les corresponden, entre ellos
              Supabase (base de datos y autenticación), Vercel (alojamiento y
              analítica técnica), Resend (envío de email) y Cloudflare Turnstile
              (protección frente a abuso en formularios y autenticación).
            </p>
            <p className="mt-2">
              También podremos comunicar información cuando exista una obligación
              legal, requerimiento válido de una autoridad o sea necesario para
              formular, ejercer o defender reclamaciones. Wetudy no vende datos
              personales a anunciantes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Transferencias internacionales</h2>
            <p className="mt-2">
              Algunos proveedores o sus subencargados pueden tratar información
              fuera del Espacio Económico Europeo. Cuando sea aplicable, estas
              transferencias se apoyarán en una decisión de adecuación, el Marco de
              Privacidad de Datos UE-EE. UU. cuando resulte aplicable, cláusulas
              contractuales tipo de la Comisión Europea u otra garantía válida
              prevista por la normativa de protección de datos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Conservación</h2>
            <p className="mt-2">
              Conservamos los datos de cuenta mientras esta se mantenga activa y
              durante el tiempo adicional necesario para gestionar seguridad,
              incidencias, obligaciones legales o posibles reclamaciones. Las
              publicaciones, chats, acuerdos, valoraciones, reportes y tickets se
              conservarán durante el tiempo necesario para prestar el servicio,
              preservar su integridad, prevenir abusos y acreditar actuaciones
              relevantes.
            </p>
            <p className="mt-2">
              Cuando los datos dejen de ser necesarios se eliminarán, bloquearán o
              anonimizarán según corresponda. Los proveedores técnicos pueden aplicar
              sus propios periodos operativos de conservación dentro de las
              instrucciones y garantías contractuales aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Menores de edad</h2>
            <p className="mt-2">
              Wetudy permite cuentas de estudiante a partir de los 14 años. Las
              personas menores de 14 años no deben crear una cuenta propia; el uso
              del servicio debe realizarse a través de su familia o representante
              cuando corresponda. Los estudiantes menores de 18 años deben utilizar
              el servicio con supervisión o intervención familiar cuando resulte
              necesaria según la naturaleza del acuerdo.
            </p>
            <p className="mt-2">
              No publiques datos personales de otros menores, fotografías que
              permitan identificarlos ni información sensible que no sea necesaria
              para reutilizar material escolar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cookies, analítica y protección frente a bots</h2>
            <p className="mt-2">
              Wetudy utiliza los mecanismos técnicos necesarios para sesión,
              autenticación y seguridad. Vercel Web Analytics se utiliza para
              medición agregada del tráfico sin cookies de seguimiento entre sitios.
              Cloudflare Turnstile procesa señales técnicas del navegador para
              distinguir tráfico legítimo de automatismos en determinadas acciones
              sensibles.
            </p>
            <p className="mt-2">
              Si se incorporasen en el futuro cookies o tecnologías opcionales para
              finalidades que requieran consentimiento, se habilitará el mecanismo
              correspondiente antes de utilizarlas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Decisiones automatizadas</h2>
            <p className="mt-2">
              Wetudy no adopta actualmente decisiones exclusivamente automatizadas
              que produzcan efectos jurídicos o afecten de forma similar y
              significativa a los usuarios. Determinados controles automáticos de
              seguridad, limitación de frecuencia o detección de bots pueden impedir
              temporalmente una acción para proteger el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Tus derechos</h2>
            <p className="mt-2">
              Puedes solicitar, cuando corresponda, acceso, rectificación,
              supresión, limitación del tratamiento, oposición y portabilidad.
              Cuando un tratamiento se base en tu consentimiento, también puedes
              retirarlo sin afectar a la licitud del tratamiento anterior.
            </p>
            <p className="mt-2">
              Para ejercerlos escribe a{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="mailto:hola@wetudy.com"
              >
                hola@wetudy.com
              </a>
              . Podemos solicitar información razonable para verificar la identidad
              antes de atender una petición. También puedes presentar una reclamación
              ante la{" "}
              <a
                className="font-medium text-primary hover:underline"
                href="https://www.aepd.es"
                target="_blank"
                rel="noreferrer"
              >
                Agencia Española de Protección de Datos
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Notificaciones legales y soporte</h2>
            <p className="mt-2">
              Los datos enviados mediante el{" "}
              <Link
                className="font-medium text-primary hover:underline"
                href="/legal/notificar-contenido"
              >
                canal de notificación de contenido presuntamente ilícito
              </Link>{" "}
              se utilizan para localizar y revisar el contenido, documentar la
              actuación, comunicarnos con quien notifica cuando proceda y cumplir
              obligaciones legales. Para consultas generales utiliza el{" "}
              <Link className="font-medium text-primary hover:underline" href="/help">
                centro de ayuda
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Cambios en esta política</h2>
            <p className="mt-2">
              Esta política puede actualizarse cuando cambie el servicio, sus
              proveedores o las obligaciones aplicables. La fecha de la última
              actualización aparecerá al inicio. Si un cambio afecta de forma
              relevante al uso de los datos, se comunicará de manera adecuada antes
              de que produzca efectos cuando resulte necesario.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
