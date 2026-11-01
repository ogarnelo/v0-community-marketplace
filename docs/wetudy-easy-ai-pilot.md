# Wetudy Easy — piloto de publicación asistida por IA

## Alcance de esta PR

La opción **Completar con IA** se muestra dentro del formulario actual de publicación.
Tras pulsarla, se envían **como máximo dos fotos nuevas**, JPG/PNG/WEBP de hasta 3 MB cada una, a un endpoint autenticado de Next.js.
Se solicitan sugerencias de título, descripción, categoría y, cuando son verificables, curso, ISBN, editorial, marca y modelo.

- **No publica anuncios**. La solicitud envía `store: false` para no almacenar respuestas como datos de aplicación, pero siguen aplicándose las políticas de retención y seguridad del proveedor.
- **No modifica precio, estado ni venta/donación**.
- **No sobrescribe campos que la familia ya ha rellenado**.
- El anuncio sigue publicándose solo por el flujo actual y con sus validaciones.
- El análisis es opcional; publicar manualmente continúa disponible.
- Por prudencia no se reenvían automáticamente las URL de fotos de borradores recuperados: para analizarlas deben seleccionarse nuevas fotos.
- Si el modelo no puede identificar el producto, se mantiene el formulario manual.

## Activación segura (desactivada por defecto)

Variables **solo de servidor**, configuradas en un entorno de pruebas (Preview) de Vercel:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_AI_PUBLISH_PILOT` | `true` para mostrar el botón en Preview (no contiene secretos) |
| `AI_PUBLISH_ENABLED` | `true` para habilitar pruebas |
| `OPENAI_API_KEY` | Clave secreta del proyecto API, nunca `NEXT_PUBLIC_` |
| `AI_PUBLISH_ALLOWED_USER_IDS` | UUID de una o varias cuentas piloto separadas por coma |
| `OPENAI_LISTING_MODEL` | Opcional; predeterminado `gpt-5.6-luna` (más económico) |

Mantener `AI_PUBLISH_ENABLED` sin definir en producción hasta terminar la revisión de seguridad y el control robusto del gasto.
La ruta rechaza solicitudes si no está activada, si no hay clave, si no existe sesión válida o si la cuenta no está en la lista de invitadas.

**Pendiente antes de abrir la función al público:** implementar cuota diaria persistente por cuenta y controles antiabuso (rate limiting), fijar presupuesto/alertas en OpenAI, revisar RGPD y tratamiento de datos de fotos escolares, confirmar compatibilidad real y costes del modelo, medir calidad y latencia de un conjunto de al menos 30 fotos variadas. La lista blanca no sustituye al rate limiting.

## Prueba manual (sin publicar ni cobrar hasta activar la API)

1. Iniciar sesión con una cuenta piloto y entrar en Nuevo anuncio.
2. Subir una foto JPG/PNG/WEBP de hasta 3 MB.
3. Pulsar **Completar con IA** y comprobar sugerencias; asegurar que precio y estado siguen vacíos.
4. Corregir descripción, categoría y curso, rellenar los campos pendientes y publicar mediante el botón habitual.
5. Probar sin fotos, fotos de gran tamaño, sesión caducada, cuenta no permitida y error temporal del proveedor.
6. Comprobar que la publicación normal sigue funcionando aunque la IA esté desactivada.

Pruebas de contrato: `npm run test:ai-assisted-publish`.

## Costes

La API del proveedor se factura por consumo de imágenes y tokens, por separado de ChatGPT.
Cada pulsación aprobada de una cuenta piloto puede generar una solicitud facturable; el endpoint no hace reintentos automáticos.
Revisar el gasto real por 30 análisis antes de ampliar el piloto. WhatsApp **no** forma parte de esta PR.

## Demostración visual sin cuenta

La ruta `/demo/wetudy-easy` solo está disponible en despliegues Vercel `preview`; en producción devuelve 404. Muestra ejemplos **simulados**, sin realizar llamadas a IA o Supabase. Las fotos que el usuario seleccione se previsualizan exclusivamente con `URL.createObjectURL` en su navegador. La demostración NO verifica reconocimiento real de productos.

El proyecto usa Vercel Authentication para las vistas Preview. Para compartir la demo de forma puntual puede utilizarse un enlace temporal de Vercel; evitar cambiar las restricciones de seguridad del login o dirigir pruebas a operaciones sobre la base de datos de producción.

## Alternativas más económicas

Mantener el reconocimiento por ISBN existente en Wetudy cuando aplique y reservar una sola petición visual para otros artículos. Priorizar `gpt-5.6-luna`, que tiene menor precio por token que `gpt-5.4-mini`, y comparar con Gemini Flash-Lite en pruebas controladas. No prometer coste fijo por fotografía: dependen de resolución, tokens y uso real.
