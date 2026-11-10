# WETUDY — Puerta de respaldo antes de migrar alertas (Free)

**Estado verificado el 10/11/2026**:
- Organización Supabase **Wetudy**: plan `free`. Ese plan no justifica asumir backups diarios administrados. [Documentación oficial](https://supabase.com/docs/guides/platform/backups).
- Ya existe una alternativa propia en GitHub: workflow `Wetudy encrypted database backup`, que produce un artefacto cifrado de 7 días tras un `pg_dump` de la base.
- Última copia verificada mediante metadatos de GitHub: **8 de noviembre de 2026**, artefacto `13618275942`; vence el **15 de noviembre de 2026**. No se han descargado ni inspeccionado contenidos de familias.
- `Wetudy combined encrypted backup recovery check` concluyó correctamente el **9 de noviembre de 2026**, pero **solo restauró el directorio público de centros** en PostgreSQL efímero y comprobó un archivo de Storage. No certifica una restauración íntegra de Auth, mensajes, anuncios, transacciones ni objetos de Storage de producción.

## Puerta automática, sin datos privados

`scripts/pilot-alert-encrypted-backup-freshness.py` **solo** examina JSON de metadatos de GitHub:
1. Debe existir una copia cifrada creada hace **menos de 24 horas** y con **más de 48 horas** hasta su vencimiento.
2. Debe existir al menos una ejecución exitosa de la recuperación **parcial** posterior a esa copia.
3. La comprobación no restaura, descarga ni descifra archivos y no usa la base productiva.

Ejemplo (en un equipo autorizado con `gh` ya autenticado, con Python 3; no imprimir ni compartir tokens):

```bash
set -euo pipefail
umask 077
repo="ogarnelo/v0-community-marketplace"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
gh api "repos/$repo/actions/artifacts?name=wetudy-encrypted-postgres-backup&per_page=100" > "$dir/artifacts.json"
gh api "repos/$repo/actions/workflows/pilot-combined-encrypted-recovery.yml/runs?per_page=100" > "$dir/runs.json"
gh api "repos/$repo/actions/workflows/wetudy-encrypted-db-backup.yml/runs?per_page=100" > "$dir/backup-runs.json"
python3 scripts/pilot-alert-encrypted-backup-freshness.py \
  --artifacts-json "$dir/artifacts.json" --runs-json "$dir/runs.json" \
  --backup-runs-json "$dir/backup-runs.json"
```

**Con la última copia del 8 de noviembre, esta puerta falla a propósito** por antigüedad. Renovar con `Actions > Wetudy encrypted database backup > Run workflow` en `main` y a continuación ejecutar `Wetudy combined encrypted backup recovery check`. Ambos workflows existentes requieren secretos ya configurados; nunca pegar URLs de conexión o passwords en chats o archivos.

Una copia nueva y el test parcial en verde son **necesarios pero no suficientes** para autorizar las migraciones. Un operador debe confirmar el alcance de respaldo y capacidad de recuperación íntegra, y que no se perderá evidencia relevante. Restaurar siempre en base efímera independiente, jamás sobre producción. No crear una rama Supabase facturable sin aprobación del coste.

## Estado de la activación

Cinco migraciones de alertas siguen sin aplicar, worker OFF, cron OFF, dos banderas ausentes, seis DEMO intactos, issue #375 abierto. Esta puerta de metadatos no activa nada y no sustituye la E2E real con correos QA adultos.

## Validación de procedencia reforzada

Además de la frescura, el artefacto debe enlazar con una ejecución **correcta** del workflow oficial `wetudy-encrypted-db-backup.yml` en `main`, con fecha anterior al artefacto. El ensayo posterior también debe proceder del workflow oficial `pilot-combined-encrypted-recovery.yml` en `main`. Una copia con nombre idéntico creada desde otro workflow o una ejecución fallida no puede pasar este filtro. Esta es evidencia de procedencia en los **metadatos de GitHub**, no una garantía criptográfica independiente ni una restauración completa.
