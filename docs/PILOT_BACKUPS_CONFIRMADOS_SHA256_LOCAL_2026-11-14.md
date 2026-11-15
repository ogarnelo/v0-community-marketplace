# WETUDY — Comprobar las copias CIFRADAS ya descargadas (Supabase Free)

Corte: 14/11/2026. Origen: backups reales anteriores, conservados privadamente por el fundador. **No generes nuevas copias para este paso.**

## Evidencias existentes

| Backup | Ejecución GitHub | Artefacto | Expira GitHub (UTC) | Estado |
|---|---|---|---|---|
| PostgreSQL + ACL | [43105818628](https://github.com/ogarnelo/v0-community-marketplace/actions/runs/43105818628) | 13894680992 | 18/11/2026 21:47:30 | ZIP conservado, confirmado fundador; integridad local sin verificar |
| Storage, 35 objetos | [43152640909](https://github.com/ogarnelo/v0-community-marketplace/actions/runs/43152640909) | 13913674235 | 19/11/2026 04:07:49 | ZIP conservado, confirmado fundador; integridad local sin verificar |

Los workflows cifraron, descifraron de prueba y comprobaron los manifiestos en origen. Ahora solo necesitamos repetir SHA256 **en los ZIP descargados**.

## Comando local, sin contraseña ni extracción

Con Python 3 en el equipo privado donde están los dos ZIP, obtener el script de este repositorio (rama de PR en revisión hasta integración) y ejecutar:

```bash
python3 scripts/pilot-offline-backup-zip-verify.py --db "/ruta/privada/backup-postgres.zip" --storage "/ruta/privada/backup-storage.zip"
```

Windows: `py -3 scripts/pilot-offline-backup-zip-verify.py --db "C:\\privado\\postgres.zip" --storage "C:\\privado\\storage.zip"`.

Salida esperada: `PASS database`, `PASS storage`, `INTEGRITY OK`. Ante `NO-GO`, no borres ni abras los originales; comprueba que has seleccionado los dos ZIP correctos. El script **solo lee y calcula SHA256**, no extrae, descifra, pide contraseña, llama a internet, usa Supabase ni registra rutas personales. Rechaza miembros extraños, duplicados, ZIP con rutas, enlaces y manifiestos inesperados.

**Límites:** SHA256 contra el manifiesto incluido en cada ZIP solo detecta integridad local; no acredita autenticidad criptográfica externa, actualizaciones posteriores, cobertura de todos los objetos, descifrado ni recuperación completa. No publicar ZIP, contraseñas, rutas de familias o logs con datos sensibles en issues o chats. Conservar copia secundaria cifrada fuera de GitHub.

## Estado de salida

- ZIP PostgreSQL/ACL conservado: **confirmado por fundador**.
- ZIP Storage conservado: **confirmado por fundador**.
- Integridad SHA256 local: **pendiente de ejecutar/comunicar PASS**.
- Restauración combinada parcial: **ya superada**.
- Recuperación integral Auth/DB/Storage real: **NO-GO**, sin segundo proyecto Supabase ni Pro.
