# Revisión jurídica y de producto — Wetudy — 21/09/2026

> Revisión de producto y documentación para el MVP actual. No sustituye el asesoramiento jurídico profesional ni la validación fiscal/mercantil del titular definitivo.

## Alcance revisado

- Alta, autenticación y perfiles.
- Marketplace de material escolar, chat, acuerdos, valoraciones y reportes.
- Centros educativos y paneles agregados.
- Soporte y moderación.
- Privacidad, proveedores técnicos y transferencias.
- Menores.
- Contenido generado por usuarios y obligaciones de intermediación.
- Flujo actual sin pagos ni envíos integrados.
- SEO/analítica técnica y tecnologías de seguridad.

## Bloqueo previo a apertura general

### 1. Identidad legal del prestador y responsable — PENDIENTE

No se ha añadido una identidad por instrucción del proyecto.

Antes de una apertura general deben incorporarse, como mínimo y según corresponda:

- nombre o denominación del prestador;
- domicilio o dirección del establecimiento;
- email de contacto;
- NIF;
- datos registrales si resultan aplicables;
- la misma identidad como responsable del tratamiento en la Política de privacidad.

Referencia: art. 10 de la Ley 34/2002 (LSSI) y deber de información de los arts. 13/14 RGPD.

Contacto operativo actual: hola@wetudy.com.

## Cambios incorporados en esta revisión

### Privacidad

La política pasa a describir:

- categorías de datos;
- finalidades y bases jurídicas diferenciadas;
- proximidad mediante código postal;
- tratamiento relacionado con centros educativos;
- proveedores: Supabase, Vercel, Resend y Cloudflare Turnstile;
- transferencias internacionales y garantías;
- criterios de conservación;
- menores;
- cookies/analítica técnica/seguridad;
- decisiones automatizadas;
- derechos y reclamación ante AEPD;
- notificaciones de contenido presuntamente ilícito.

No se utiliza una aceptación genérica de la Política de privacidad como consentimiento para todo tratamiento.

### Términos

Los términos aclaran:

- papel de Wetudy como intermediario tecnológico;
- responsabilidad sobre publicaciones;
- uso por menores;
- pagos y entregas acordados directamente entre las partes;
- ausencia de custodia de dinero y envíos integrados;
- usuarios que puedan actuar profesionalmente;
- privacidad de centros educativos;
- moderación, restricciones y motivos;
- canal de contenido presuntamente ilícito;
- licencia técnica limitada para alojar/publicar contenido;
- convivencia, suspensión y cierre;
- responsabilidad sin excluir derechos imperativos;
- ley y jurisdicción sin privar al consumidor de protecciones obligatorias.

### Registro

El alta exige:

- aceptar los Términos de uso;
- confirmar que se ha leído la Política de privacidad.

La Política de privacidad se presenta como información, no como consentimiento contractual indiscriminado.

## DSA / contenido generado por usuarios

### Canal de notificación

Se incorpora un canal electrónico público en:

- /legal/notificar-contenido
- enlace permanente en footer;
- enlace próximo al botón de reporte del anuncio.

El flujo permite:

- URL exacta del contenido;
- explicación motivada;
- nombre y email;
- declaración de buena fe;
- excepción de omisión de identidad para el supuesto específico previsto para posibles delitos sexuales contra menores;
- acuse de recibo por email cuando se facilita dirección;
- aviso a Super Admin;
- almacenamiento server-side sin permitir inserción directa desde el navegador.

### Decisiones de moderación — PROCEDIMIENTO OPERATIVO PENDIENTE DE AUTOMATIZAR

Cuando se retire, restrinja o suspenda contenido/cuenta por ilegalidad o incompatibilidad con los términos, el equipo debe comunicar al usuario afectado una motivación suficientemente concreta y las vías de revisión cuando la normativa lo exija.

En el MVP no existe todavía una acción única de moderación que retire contenido y envíe automáticamente esa exposición de motivos. Hasta automatizarla, esta comunicación debe formar parte del procedimiento manual de moderación.

## Menores — MEDIDA DE MVP ADOPTADA

Wetudy admite perfiles de estudiante, pero no recopila fecha de nacimiento.

Para reducir el riesgo del MVP se fija una regla operativa clara:

- las cuentas de estudiante requieren confirmar 14 años o más;
- menores de 14 años no deben crear cuenta propia y deben usar el servicio a través de su familia o representante cuando corresponda;
- estudiantes menores de 18 años deben contar con supervisión o intervención familiar cuando sea necesaria por la naturaleza del acuerdo;
- no se deben publicar datos o imágenes de otros menores que no sean necesarios.

Esta medida cubre el umbral español de consentimiento de protección de datos, pero no sustituye la revisión externa de capacidad contractual de menores según cada operación. Antes de dirigir campañas específicamente a menores o ampliar operaciones de mayor importe/riesgo, debe revisarse de nuevo el modelo.

## Usuarios profesionales / consumo — DECISIÓN ADOPTADA PARA EL MVP

El MVP está orientado principalmente a reutilización comunitaria.

El MVP se limita a uso particular y comunitario y no permite utilizar Wetudy como canal habitual de venta empresarial o profesional. Esta decisión evita presentar el producto actual como un marketplace para vendedores profesionales sin la identificación e información precontractual específica que ese modelo exigiría.

Si más adelante Wetudy admite vendedores profesionales, deberá implementarse antes su identificación visible, la información precontractual aplicable y la revisión específica de consumo/marketplace.

## Cookies, analítica y seguridad

Revisión técnica actual:

- Vercel Web Analytics para medición agregada sin cookies publicitarias de seguimiento;
- Cloudflare Turnstile para seguridad/bots;
- cookies/tokens técnicos de autenticación de Supabase;
- no se ha identificado Google Analytics, Meta Pixel u otra analítica publicitaria en el flujo revisado.

Si se añaden tecnologías opcionales de publicidad, remarketing o analítica que requieran consentimiento, deberá revisarse el banner/gestor de consentimiento antes de activarlas.

## Encargados y transferencias

Proveedores técnicos identificados:

- Supabase — base de datos y autenticación;
- Vercel — hosting y analítica;
- Resend — email transaccional;
- Cloudflare — Turnstile/seguridad.

Acción organizativa recomendada: conservar y revisar DPAs, listas de subencargados y mecanismos de transferencia aplicables; revaluar ante cambios relevantes de proveedor.

## Conservación y derechos

La política pública utiliza criterios de conservación para no inventar plazos que el backend no aplica.

Pendiente organizativo:

- documentar internamente plazos/criterios por categoría;
- procedimiento para acceso, rectificación, supresión, oposición, limitación y portabilidad;
- procedimiento de borrado/bloqueo cuando haya incidencias, reportes o posibles reclamaciones;
- registro interno de solicitudes y respuesta.

## Seguridad y brechas

Mantener:

- RLS y acceso server-side;
- límites de frecuencia y Turnstile;
- control de roles;
- revisión periódica de Security Advisor;
- proceso interno para evaluar y, cuando corresponda, notificar brechas a AEPD y personas afectadas.

Leaked Password Protection permanece pendiente hasta pasar a un plan de Supabase que lo permita.

## Pagos y envíos

El MVP actual no integra checkout, custodia de fondos ni logística. Esto reduce de forma material las obligaciones que surgirían al operar pagos o envíos en nombre de usuarios.

Antes de activar Stripe, buyer protection, wallet, retenciones o envíos integrados debe realizarse una revisión jurídica separada.

## Checklist jurídico de lanzamiento

- [ ] Completar identidad legal, domicilio, NIF y datos registrales aplicables.
- [ ] Validación externa final de Privacy/Terms y modelo de menores.
- [x] Email operativo hola@wetudy.com.
- [x] Política de privacidad ampliada.
- [x] Términos de uso ampliados.
- [x] Aceptación de términos en registro.
- [x] Canal público de notificación de contenido presuntamente ilícito.
- [x] Acuse electrónico de recepción cuando hay email.
- [x] Punto de contacto electrónico DSA y resumen comprensible para estudiantes menores.
- [x] Explicación pública de los criterios actuales de ordenación del marketplace.
- [ ] Automatizar exposición de motivos cuando una acción de moderación retire/restrinja contenido.
- [x] Limitar el MVP actual a uso particular/comunitario; revisar de nuevo antes de admitir vendedores profesionales.
- [ ] Documentar internamente conservación, derechos RGPD y brechas.
- [ ] Leaked Password Protection al migrar a Supabase Pro.
