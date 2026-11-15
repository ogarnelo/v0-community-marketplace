# WETUDY — Guía operativa de custodia de backups existentes
15/11/2026, #455. Referencias: run PG 43105818628 / artifact 13894680992; run Storage 43152640909 / artifact 13913674235; restore combinado parcial run 43153468952. Artefactos se han comprobado como NO caducados en GitHub el 15/11. El almacenamiento privado de su contenido NO está acreditado.

## Antes de caducar (intervención del operador)
1. Descargar los dos artefactos cifrados desde la sección Artifacts de los runs anteriores a equipo/almacenamiento autorizado, jamás a PR/issues/chat ni carpeta pública. No registrar ni copiar contraseñas en logs.
2. Confirmar localmente que existen y conservar una segunda copia privada protegida, respetando normativa del proyecto. No descifrar por simple inspección.
3. Anotar en manifiesto **privado** nombre, bytes y SHA-256 calculados localmente y fecha UTC, sin publicar ese manifiesto ni ruta personal.
4. Mantener testigos de restauración parcial separados y no confundirlos con recuperación certificada.
5. Planificar restauración DB/ACL, Auth/GoTrue, Storage y permisos solo en laboratorio aislado autorizado; verificar integridad, recuperación funcional y tiempos RTO/RPO. Sin segundo proyecto Supabase ni Supabase Pro.

## Criterio NO-GO
Copia cifrada almacenada != respaldo recuperable íntegro; éxito de CI sintética != DR certificado. Sólo revisión humana documentada puede cerrar #455.
