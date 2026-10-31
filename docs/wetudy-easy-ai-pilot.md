# Wetudy Easy — piloto de publicación asistida por IA

## Alcance de esta PR

La opción **Completar con IA** se muestra dentro del formulario actual de publicación.
Tras pulsarla, se envían **como máximo dos fotos nuevas**, JPG/PNG/WEBP de hasta 3 MB cada una, a un endpoint autenticado de Next.js.
Se solicitan sugerencias de título, descripción, categoría y, cuando son verificables, curso, ISBN, editorial, marca y modelo.

- **No publica anuncios** ni guarda fotos en el proveedor de IA de manera deliberada: `store: false` en la solicitud.
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
| `AI_PUBLISH_ENABLED` | `true` para habilitar pruebas |
| `OPENAI_API_KEY` | Clave secreta del proyecto API, nunca `NEXT_PUBLIC_` |
| `AI_PUBLISH_ALLOWED_USER_IDS` | UUID de una o varias cuentas piloto separadas por coma |
| `OPENAI_LISTING_MODEL` | Opcional; predeterminado `gpt-5.4-mini` |

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
