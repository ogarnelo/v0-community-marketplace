# Auditoría MVP Wetudy · bloques 1-4

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

### Pendiente visual/manual

- Validar en móvil real: filtros laterales, CTA de publicar, detalle de anuncio y chat.
- Revisar logo final público para emails: el template usa `NEXT_PUBLIC_EMAIL_LOGO_URL` o `/wetudy-logo.png` como fallback.

## Bloque 2 · Emails transaccionales

- Se crea una base visual reutilizable `emailShell`.
- Se aplica azul corporativo como color principal.
- Se añade cabecera con logo.
- Se añade footer consistente con el posicionamiento MVP: Wetudy facilita contacto, chat e historial; la entrega y el pago se acuerdan directamente entre las partes.
- Se evita el copy `fuera de Wetudy`.
- Se dejan botones compatibles con clientes de email usando tablas e inline styles.

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

Comprobación pendiente en preview: revisar que el CTA principal empuje a marketplace/publicar sin prometer checkout ni logística integrada.

### `/auth`

Rol en el funnel: registro/login.

Hallazgo ya resuelto: el email de bienvenida llega usando Resend con `noreply@wetudy.com` tras verificar `wetudy.com` y actualizar la API key.

Pendiente: convertir el disparo del email en fire-and-forget para que la navegación post-login no espere al endpoint.

### `/marketplace`

Cambio aplicado: server-first + filtros cliente + demand intelligence.

Criterio de aceptación:

- muestra anuncios sin esperar a un fetch client-side inicial;
- permite buscar y filtrar;
- registra señales si hay búsqueda/filtro;
- permite priorizar centro sin ocultar toda la oferta por defecto.

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

Pendiente de producto: mejorar onboarding hacia publicar/revisar actividad y añadir recordatorios de reseña.

### `/admin/super/mvp`

Estado previo: panel operativo general.

Mejora añadida alrededor: nueva vista `/admin/super/demand` para señales de demanda.

## Validación técnica esperada

```bash
npm run test:contracts
npm run build
```

## Nota de despliegue

La migración `marketplace_search_events_v1` se aplicó directamente en Supabase y también queda versionada en el repo.
