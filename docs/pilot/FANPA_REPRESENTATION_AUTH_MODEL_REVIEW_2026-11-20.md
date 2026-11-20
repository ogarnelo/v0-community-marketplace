# WETUDY — FANPA/FAMPA/CEAPA: autorización por colegios representados

**Estado: propuesta de implementación, sin SQL aplicado ni apertura del piloto.**

## Reglas de seguridad y ámbito

- La federación debe estar activa y no ser un registro ficticio.
- El usuario debe tener un vínculo personal, expreso y activo con esa federación. Los permisos de superadmin y school_admin no conceden acceso federativo por sí solos. No aceptar user_metadata ni dominios de email como autoridad.
- La federación debe tener enlaces expresos, activos, a colegios operativos activos, excluidos los de prueba. La revocación del vínculo retira el colegio del informe.
- Un error o lectura parcial de federación, membresía, enlaces o colegios bloquea todo el informe. No se mostrarán totales parciales.
- Una federación no es un colegio, ni representa automáticamente AMPAs no vinculadas.
- Solo devolver KPI agregados. Las necesidades e intercambios de cohortes menores de cinco se ocultan, también en los totales cuando puedan permitir inferencias por diferencia. Nunca serializar IDs de familias o de estudiantes.

## Implementación futura: requisitos antes de abrir el panel

1. Aprobar una migración separada con tablas de federaciones, usuarios autorizados y escuelas representadas. RLS activa, sin grants para anon ni authenticated. No modificar la restricción general de user_roles para crear fanpa_admin por comodidad.
2. Leer identidad confirmada y vínculos solo desde servidor; autenticar, autorizar, revalidar contra revocaciones y devolver únicamente la proyección agregada. Ningún cliente recibe claves de service_role.
3. Limitar las consultas personales al ámbito permitido directamente en SQL. NO repetir la consulta global a account_students del panel antiguo #240.
4. Resolver con una consulta mínima el caso de perfil escolar obsoleto cuando hay alumnos activos en otro colegio: no basta con filtrar los alumnos por los centros representados, porque se perdería la señal de pertenencia a otro centro.
5. Probar con federaciones y colegios ficticios en PG17 aislado: suplantación de federación, filtro por colegio ajeno, vínculo revocado, colegio inactivo, grants duplicados, fallo de proveedor, familias multicolegio, cohortes de 1 a 4 y ataques por diferencia entre total y filas.
6. Ejecutar preflight de grants y RLS antes de aplicar la migración, y postflight. Sin autorización específica NO realizar DDL ni habilitar el panel.

## Alcance de lo ya integrado

PR #769: cálculo KPI y deduplicación de familias. PR #770: proyección restringida y privacidad. Esta PR: resolvedor puro de autorización por representación. Los tres componentes no consultan DB ni crean endpoints; son una base técnica, NO una entrega de panel operativo.

Fuente de continuidad: https://github.com/ogarnelo/v0-community-marketplace/issues/767
