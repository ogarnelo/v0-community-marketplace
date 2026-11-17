# WETUDY — vista local de ensayo FAMPA / CEAPA

Este entorno de ensayo permite revisar la interfaz de KPI sin conceder acceso federativo en producción.

Desde un checkout local de WETUDY: `npm run dev` y abrir `http://localhost:3000/internal/federation-report-preview`.

- La ruta está programada para responder **404** cuando `NODE_ENV` no sea `development`, incluidos Vercel preview y producción.
- Todos los colegios, federaciones y números son **sintéticos** y están incorporados al cliente de demostración. No hay consultas a Supabase, ni correos, cuentas, ni cambios de roles.
- Permite ensayar los selectores de periodo 90d, 365d e histórico y el filtro por colegio; dos escenarios: KPI visibles y supresión de grupo pequeño.
- La pantalla muestra etiquetas "solo lectura" y "demostración local" y no incluye botones administrativos.
- Esta página no valida ni sustituye E2E real. Para un panel operativo habrá que aprobar y aplicar un esquema jurídico federativo, verificar relaciones AMPA/colegio/FAMPA/CEAPA, controles RLS, privacidad, endpoint server-only, revisión de cache y pruebas con cuentas legítimas.

**Restricción obligatoria:** no eliminar el guard de `NODE_ENV` ni convertir el demo en un endpoint conectado a un cliente privilegiado sin autorización específica. El candidato de esquema #649 permanece REVIEW ONLY. Piloto general NO-GO.
