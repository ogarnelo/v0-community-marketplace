# Auditoría MVP Wetudy · bloques 1-4

## Resultado ejecutivo

La auditoría no debe leerse como una validación visual completa de producción. Los cambios están en PR y la preview de Vercel está protegida por SSO, por lo que la navegación real clic-a-clic queda pendiente de revisión manual o de validación posterior en producción.

Resultado por ahora:

- Build de Vercel preview: correcto.
- Bloques 1-4 implementados en rama de PR.
- Migración de demand intelligence aplicada en Supabase y versionada.
- Email de bienvenida operativo en producción con `noreply@wetudy.com` antes de este PR.
- Pendiente: navegación visual real como usuario final después de merge o con preview accesible.

## Objetivo

Aplicar mejoras de producto antes de lanzamiento sobre cuatro frentes:

1. UX crítica del MVP.
2. Emails transaccionales con marca.
3. Control admin para operar sin estar encima todo el día.
4. Demand intelligence para entender qué busca la comunidad.

## Bloque 1 · UX crítica del MVP

### Marketplace

- `/marketplace` pasa de carga 100% client-side a carga server-first.
- El usuario ve anuncios iniciales renderizados por servidor y mantiene filtros interactivos en cliente.
- Se añade filtro explícito `Solo mi comunidad` cuando el usuario tiene centro asociado.
- La comunidad se mantiene como filtro/priorización, no como bloqueo global de visibilidad.
- Se normaliza búsqueda textual ignorando acentos y mayúsculas.
- Inputs de precio del marketplace usan `inputMode="decimal"` y `type="text"` para evitar spinners nativos.
- Estado vacío explica que la demanda queda registrada para entender qué material falta.

### Onboarding sin fricción

Hallazgo: obligar emocionalmente al usuario a resolver el colegio justo después del registro puede bloquear el avance si no tiene código, hay error de validación o el centro no existe.

Cambio aplicado:

- `/onboarding/join-school` presenta el centro como recomendable, no obligatorio.
- Añade CTA visible `Continuar sin centro por ahora`.
- Los errores de código explican que el usuario puede continuar y añadir el centro después.
- Mantiene la posibilidad de buscar centro o registrar uno nuevo.

Criterio de producto: crear cuenta debe ser posible incluso si el colegio falla. Vincular centro mejora confianza/filtros, pero no debe impedir explorar el marketplace.

### Pendiente visual/manual

- Validar en móvil real: filtros laterales, CTA de publicar, detalle de anuncio y chat.
- Revisar cómo se ofrece la opción de añadir centro desde `/account` después de saltar onboarding.

## Bloque 2 · Emails transaccionales

- Se crea una base visual reutilizable `emailShell`.
- Se aplica azul corporativo como color principal.
- Se usa un wordmark textual de Wetudy en cabecera para no depender de un logo público inexistente.
- Se añade footer consistente con el posicionamiento MVP: Wetudy facilita contacto, chat e historial; la entrega y el pago se acuerdan directamente entre las partes.
- Se evita el copy `fuera de Wetudy`.
- Se dejan botones compatibles con clientes de email usando tablas e inline styles.

Pendiente posterior: cuando exista logo definitivo, sustituir el wordmark textual por una imagen pública optimizada y probada en Gmail/Apple Mail/Outlook.

## Bloque 3 · Admin útil

Se añade `/admin/super/demand` para revisar señales de demanda:

- búsquedas registradas;
- búsquedas sin resultados;
- uso del filtro de comunidad;
- oportunidades por categoría y curso;
- señales recientes con número de resultados.

Esto complementa `/admin/super/mvp`, que ya cubre usuarios, anuncios, conversaciones, acuerdos, reportes y actividad.

## Bloque 4 · Demand intelligence

Se añade tabla `marketplace_search_events` y vista `marketplace_demand_summary`.

Eventos capturados desde `/marketplace`:

- texto buscado;
- ISBN;
- categoría;
- curso;
- tipo de anuncio;
- estado del material;
- rango de precio;
- solo mi comunidad;
- radio/cerca de mí;
- número de resultados;
- usuario y centro, si existe sesión.

El endpoint `/api/marketplace/search-events` no bloquea la UX si falla. Registra la señal de forma silenciosa y devuelve siempre una respuesta no disruptiva.

## Auditoría página a página

### `/`

Rol en el funnel: entrada general y construcción de confianza.

Resultado: pendiente de navegación visual real. En revisión de producto, el riesgo principal es que el mensaje prometa más de lo que el MVP ofrece. No debe sugerir checkout, logística ni pagos integrados como parte del flujo actual.

### `/auth`

Rol en el funnel: registro/login.

Resultado: el email de bienvenida ya llega con Resend desde `noreply@wetudy.com` antes de este PR.

Riesgo detectado: después del signup se empuja al usuario a vincular centro. Se corrige añadiendo salida clara para continuar sin centro.

Pendiente: convertir el disparo del email en fire-and-forget para que la navegación post-login no espere al endpoint.

### `/onboarding/join-school`

Rol en el funnel: mejorar confianza y relevancia por comunidad.

Resultado: corregido en este PR para que no sea un bloqueo. Ahora el usuario puede buscar centro, introducir código, registrar centro nuevo o continuar sin centro por ahora.

### `/marketplace`

Cambio aplicado: server-first + filtros cliente + demand intelligence.

Criterio de aceptación:

- muestra anuncios sin esperar a un fetch client-side inicial;
- permite buscar y filtrar;
- registra señales si hay búsqueda/filtro;
- permite priorizar centro sin ocultar toda la oferta por defecto.

Riesgo: hay que validar visualmente que el filtro `Solo mi comunidad` se entiende como priorización/filtro opcional y no como requisito de acceso.

### `/marketplace/new`

Estado previo: fotos obligatorias ya implementadas.

Pendiente de auditoría manual: asegurar que el formulario no ha perdido campos importantes para libros y que el caso donación limpia/oculta precio.

### `/marketplace/listing/[id]`

Estado previo: copy MVP corregido, condición humanizada, ISBN condicional, galería con hints de carga.

Pendiente de auditoría manual: medir claridad del CTA de contacto, sticky mobile y confianza del acuerdo.

### `/messages`

Rol en el funnel: cierre de acuerdos.

Pendiente de producto: emails de `nuevo mensaje`, `acuerdo propuesto` y `acuerdo confirmado`.

### `/account/*`

Rol en el funnel: confianza y gestión.

Pendiente de producto: debe quedar claro dónde añadir o corregir el centro después de saltar onboarding.

### `/admin/super/mvp`

Estado previo: panel operativo general.

Mejora añadida alrededor: nueva vista `/admin/super/demand` para señales de demanda.

### `/admin/super/demand`

Resultado: nueva vista añadida. Permitirá convertir búsquedas sin resultado en decisiones de catálogo, campaña o captación por colegio/curso.

## Validación técnica esperada

```bash
npm run test:contracts
npm run build
```

## Nota de despliegue

La migración `marketplace_search_events_v1` se aplicó directamente en Supabase y también queda versionada en el repo.
