# WETUDY — Captación y aceptación de tres AMPA (piloto cerrado)

**Fecha base:** 14/11/2026. **Objetivo condicionado:** 26/11/2026. **Situación real:** 0 AMPA confirmadas, 0 actas de aceptación real. No confundir CI sintética con aceptación de familias.

## Objetivo y responsabilidad
Conseguir **tres AMPA/AFA independientes**, con un contacto responsable adulto y personas voluntarias adultas. No recopilar nombres, datos escolares, teléfonos ni información de menores en repositorios, GitHub Issues, capturas compartidas o pruebas sintéticas.

Este documento es **kit de captación**, no prueba de invitación enviada ni de aceptación recibida. El fundador debe contactar personalmente a las entidades por canales públicos autorizados.

## Ruta realista (sin ampliar alcance de lanzamiento)
1. Crear una lista privada de 8–12 AMPA/AFA candidatas accesibles por contactos públicos o personas conocidas. Priorizar colaboración y disponibilidad; **no inventar asociaciones ni afirmar colaboraciones**.
2. Enviar invitación individual a contactos adultos legitimados. No enviar mensajes masivos ni capturar datos de menores.
3. Solicitar confirmación de tres entidades: representante, disponibilidad orientativa y aceptación de piloto cerrado. Registrar solo código `AMPA-01`, `AMPA-02`, `AMPA-03` en el Excel técnico; nombres/contactos en un registro privado gestionado por el fundador.
4. Enrolar cuentas de prueba adultas con autorización; usar datos ficticios, CP de prueba y centros de prueba. No habilitar cobros, envíos reales ni operaciones entre familias sin pasar antes puerta P0.
5. Ejecutar sesión guiada, registrar resultados y cerrar incidencia. Una AMPA está aceptada solo cuando hay acta firmada por su representante y todos los P0 quedan resueltos.
6. **NO-GO obligatorio:** si no existen las tres aceptaciones, o persisten privacidad productiva #447 / DR real #455.

## Invitación por email o WhatsApp (copiar y personalizar)
**Asunto:** Invitación a probar WETUDY con vuestra AMPA (piloto privado)

Hola, soy parte del equipo que está preparando WETUDY, una plataforma para facilitar a las familias la reutilización y búsqueda de material escolar cercano.

Estamos organizando un piloto cerrado con tres AMPA/AFA, antes de plantearnos la apertura pública. Nos gustaría invitaros a una sesión guiada de unos 30–45 minutos con personas voluntarias adultas para evaluar si la búsqueda, los anuncios y la comunicación resultan claros y útiles.

Durante el piloto utilizaríamos datos de prueba. No necesitamos datos de menores, información privada de familias ni hacer pagos o envíos reales.

¿Podríais indicarnos si os interesaría participar y quién sería la persona adulta de contacto para coordinar una sesión? Si ahora no es buen momento, no hay ningún compromiso.

Muchas gracias.

Equipo WETUDY

## Qué probar (uso autorizado, entorno de prueba)
| ID | Escenario | Criterio de aceptación | P0 si falla |
|---|---|---|---|
| AMPA-01 | Registro/inicio sesión adulto | Puede acceder sin confundir roles | Sí |
| AMPA-02 | Vinculación de centro de prueba | Se entiende el vínculo al centro | Sí |
| AMPA-03 | Publicar anuncio sintético | Datos mínimos, sin fuga de CP privado | Sí |
| AMPA-04 | Búsqueda por palabra/filtros | Resultados coherentes | No |
| AMPA-05 | Radio por CP propio | Distancia marcada como aproximada | Sí |
| AMPA-06 | Activar radio sin CP | Popup breve explica que falta CP | No |
| AMPA-07 | Scroll infinito | Se muestran todos los resultados válidos, sin botón obligatorio ni corte 180 | No |
| AMPA-08 | Reserva/negociación | Historial correcto, permisos comprador/vendedor | Sí |
| AMPA-09 | Chat entre participantes | Tercero no puede consultar conversación | Sí |
| AMPA-10 | Denuncia/reporte | No puede denunciar anuncio privado ajeno | Sí |
| AMPA-11 | Eliminar/archivar | Historial y fotos no se pierden indebidamente | Sí |
| AMPA-12 | Diseño actual del marketplace | Sin cambios estéticos disruptivos | No |
| AMPA-13 | Acceso anónimo a información privada | No revela CP ni identificadores protegidos | Sí |
| AMPA-14 | Prueba de recuperación declarada | No se proclama PASS sin prueba real | Sí |

**Excluir del ensayo con AMPA** hasta GO separado: pago real, Stripe, etiquetas Sendcloud, datos de menores, publicación productiva de anuncios reales que expongan CP.

## Acta de aceptación por asociación (una por AMPA)
- Código privado de asociación: `AMPA-01` / `AMPA-02` / `AMPA-03`
- Fecha y duración:
- Entorno autorizado (NO producción si P0 abiertos):
- Número de participantes adultos:
- Casos ejecutados: X / 14; PASS: X; FAIL: X; NO EJECUTADOS: X
- Incidencias P0 con identificador y evidencia sin datos personales:
- Evidencia de que no se utilizaron datos de menores ni cobros reales:
- Opinión voluntaria (claro/no claro; útil/no útil):
- Decisión: **ACEPTO / NO ACEPTO / PENDIENTE**
- Confirmación independiente del representante adulto (en registro privado, no GitHub):
- Aceptación solo después de cerrar P0 de privacidad, recuperación y operaciones autorizadas.

## Puerta de lanzamiento 26/11
1. `#447`: revocación ACL en producción solo tras autorización explícita y regresión E2E.
2. `#455`: restauración real de DB/Auth/Storage y RTO/RPO demostrados; un ZIP válido no basta.
3. `#245`: tres actas adultas de AMPA independientes **ACEPTO**, ninguna P0 crítica abierta.
4. PR #438 no pasa a main sin decisión y alcance explícitos.

**Estado al publicar este documento: 0/3 AMPA confirmadas, ninguna invitación enviada automáticamente.**
