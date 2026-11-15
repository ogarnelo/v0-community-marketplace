# WETUDY — PR540 · Formularios del vendedor sin exposición de errores SQL
Fecha 15/11/2026. Cambios solo en la presentación de errores al usuario; no altera validación ni reglas de negocio.

El formulario de publicación mostraba al vendedor errores Supabase/PostgREST/Storage mediante error.message/details/error_description, y registraba excepciones completas. El editor presentaba errores del proveedor de igual forma. También se mostraban mensajes no controlados de los borradores. Son superficies de familias y pueden filtrar esquema, nombres internos o detalles de objetos.

Se sustituyen en las ramas catch afectadas por mensajes genéricos en castellano y logs de tokens constantes, sin detalles de proveedores. Los mensajes de validación explícitos anteriores al submit, los estados de publicación, escuela, carga de fotos y lógica de borrador siguen intactos.

Se incorporan tres contratos Node de redacción de mensajes a Critical contracts; se requiere CI y Vercel preview antes de integrar en main. Esta PR no certifica publicación E2E con cuenta real, ni altera los permisos SQL. #245 AMPA 0/3; DR parcial previa reconocida y gestión 17/11. El propietario supabase_admin requiere operador legítimo para retirar los 16 grants por defecto que faltan; 14 tablas MAINTAIN fuera de aprobación.
