# Account Students — Phase B API

Fecha: 2026-09-27

## Objetivo

Añadir la capa server-side para gestionar estudiantes sin conectar todavía ninguna UI de producción.

## Contrato de cuenta

Los datos de la cuenta representan al titular:

- Nombre
- Apellidos
- Email
- Contraseña
- Tipo de cuenta
- Código postal

Para una cuenta Familia / Tutor, Nombre y Apellidos pertenecen al representante/titular de la cuenta.

Los estudiantes gestionados no reutilizan esos datos personales. Cada estudiante solo necesita:

- Nombre o alias opcional
- Centro
- Curso
- Año académico calculado por servidor

## Endpoints

- GET /api/account/students
- POST /api/account/students
- PATCH /api/account/students/:id
- DELETE /api/account/students/:id

DELETE hace desactivación lógica, no borrado físico.

## Reglas de seguridad

- sesión obligatoria;
- email confirmado;
- owner_user_id siempre viene de auth.uid;
- relationship se infiere desde profiles.user_type;
- el cliente no decide is_primary, sort_order ni academic_year;
- centro validado como activo;
- todas las mutaciones usan service role solo en servidor;
- cada query/update queda acotada a owner_user_id.

## Reglas de producto

### Cuenta student
- relationship = self
- máximo un contexto activo
- no puede desactivar su propio contexto
- puede editar centro, curso y alias

### Cuenta parent
- relationship = guardian
- puede tener varios estudiantes
- el primero se convierte en primary
- si se desactiva el primary, el siguiente activo se promociona

## Compatibilidad

Phase B NO:
- escribe en profiles;
- sincroniza school_id / grade_level;
- modifica /account;
- modifica signup;
- modifica Marketplace;
- cambia navbar;
- introduce student_id en búsquedas o demanda.

La API queda dormida hasta que una fase posterior conecte onboarding o /account.
