# WETUDY · FANPA: API KPI con proyección estricta y privacidad

**20/11/2026 · Bloque FANPA/FAMPA/CEAPA · revisión técnica aislada.**

## Hechos de producción contrastados (SQL SELECT de catálogo; ninguna escritura)

El proyecto Supabase `jpsljmakoscqevssimtk` tiene `public.fanpa_federations`, `public.fanpa_administrators` y `public.fanpa_represented_schools`, **cada una con RLS ON** y sin privilegio `SELECT` para `anon` o `authenticated`. La lectura corresponde a `service_role`, exclusivamente servidor. La consulta agregada devolvió **0 federaciones, 0 administradores federativos y 0 vínculos de colegios**. Esto no acredita acceso operativo federativo y no activa ninguna funcionalidad.

Las rutas `/api/fanpa/scope` y `/api/fanpa/kpis` ya usan autorización por representación en servidor con revalidación y flags desactivados salvo activación doble expresa. El antiguo PR #240 no debe reintroducirse.

## Riesgo técnico acotado

La API de KPI incorporaba `...kpis` y `...school` procedentes de un lector privilegiado. Con el lector actual los datos son solo agregados, pero un cambio futuro que añadiera campos personales o devolviera una fila de otro colegio podría terminar serializado sin una barrera de salida propia. Un cambio incorrecto en los totales podría además permitir inferir cohortes menores de cinco personas.

## Solución del subbloque

`lib/fanpa/federation-kpi-response-guard.ts` produce **únicamente** los campos documentados, copiándolos de forma explícita:

- Federación/escuela: conteo de centros, usuarios únicos (solo cuando es seguro), estudiantes, anuncios activos y totales, demandas abiertas, intercambios confirmados y colegio con nombre autorizado. **Nunca** emails, perfiles, IDs de alumnos, mensajes, filas individuales ni datos de otras federaciones.
- Comprueba igualdad exacta entre los colegios representados revalidados y los colegios devueltos, incluidos ausentes, ajenos y duplicados.
- Rechaza contadores negativos, nulos impropios, decimales, `NaN`, infinitos y sumas no seguras. Cuando el número de usuarios de un colegio es menor de cinco, el lector debe devolver `null` en **todos** sus valores sensibles, y **todos** los agregados federativos sensibles deben permanecer ocultos. Un total federal de usuarios no puede deducirse sumando colegios con familias compartidas.
- Si la proyección no pasa, `/api/fanpa/kpis` retorna un error privado `503` sin estadísticas, preservando `Cache-Control: private, no-store`. No altera el resultado autorizado de las peticiones válidas. La revalidación de identidad y representación sigue ocurriendo antes de preparar la respuesta.
- Pruebas ejecutables con la ruta TypeScript real y un lector sintético malformado: claves personales nuevas, escuelas ajenas, duplicadas o faltantes, totales contradictorios, cohortes ocultas y escuela seleccionada. Los flags siguen apagados por defecto.

**No hay migraciones, roles, usuarios, envíos, modificaciones SQL de producción ni activación de flags** en esta PR. Tampoco se reutiliza el código WIP antiguo.

## Límites y condición de salida

Estas pruebas comprueban el adaptador de salida y la ruta con servicios falsos; **no** son una sesión federativa real, un E2E sobre el esquema íntegro de producción ni una aprobación de FANPA/FAMPA/CEAPA. Los datos federativos reales siguen sin poblar y la activación requiere una prueba de representación expresa, validación legal/privacidad de agregados, responsable de cada entidad y permiso independiente. El piloto general permanece **NO-GO**. La PR debe quedar sin fusionar hasta completar CI y revisión.
