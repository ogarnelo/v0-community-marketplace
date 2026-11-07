#!/usr/bin/env python3
"""Safe, repeatable directory importer. DRY RUN unless explicitly authorized."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

PROJECT_REF = "jpsljmakoscqevssimtk"
EXPECTED_ROWS = 34845
BATCH_SIZE = 200
FIELDS = ("official_code","name","school_type","category","address","municipality",
          "province","autonomous_community","postal_code","latitude","longitude",
          "source_name","review_status")
COMMUNITIES = {
    "Andalucía","Aragón","Canarias","Cantabria","Castilla y León",
    "Castilla-La Mancha","Cataluña","Ceuta","Comunidad Foral de Navarra",
    "Comunidad de Madrid","Comunitat Valenciana","Extremadura","Galicia",
    "Illes Balears","La Rioja","Melilla","País Vasco",
    "Principado de Asturias","Región de Murcia",
}

def validate(path, expected_hash):
    actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise ValueError("La huella SHA-256 del CSV no coincide con el manifiesto")
    result, seen = [], set()
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != list(FIELDS):
            raise ValueError("Cabeceras inesperadas: no se admiten columnas con teléfonos")
        for line, raw in enumerate(reader, 2):
            if len(result) >= EXPECTED_ROWS:
                raise ValueError("Número de registros superior al previsto")
            r = {key: (raw.get(key) or "").strip() for key in FIELDS}
            code = r["official_code"]
            if not re.fullmatch(r"[0-9]{8}", code) or code in seen:
                raise ValueError("Código oficial inválido o duplicado, fila %s" % line)
            seen.add(code)
            if not re.fullmatch(r"[0-9]{5}", r["postal_code"]):
                raise ValueError("Código postal inválido, fila %s" % line)
            if r["autonomous_community"] not in COMMUNITIES:
                raise ValueError("Comunidad autónoma inválida, fila %s" % line)
            for field in ("name","school_type","category","municipality",
                          "province","source_name","review_status"):
                if not r[field]:
                    raise ValueError("Campo obligatorio ausente, fila %s" % line)
            if bool(r["latitude"]) != bool(r["longitude"]):
                raise ValueError("Coordenadas parciales, fila %s" % line)
            if r["latitude"]:
                try:
                    lat, lon = float(r["latitude"]), float(r["longitude"])
                except ValueError as exc:
                    raise ValueError("Coordenadas inválidas, fila %s" % line) from exc
                if not 27 <= lat <= 45 or not -19 <= lon <= 5:
                    raise ValueError("Coordenadas fuera de rango, fila %s" % line)
                r["latitude"], r["longitude"] = lat, lon
            else:
                r["latitude"], r["longitude"] = None, None
            if len(r["name"]) > 400 or len(r["source_name"]) > 300:
                raise ValueError("Texto demasiado largo, fila %s" % line)
            # Never import is_listed or linked_school_id; the DB defaults to false/null.
            result.append(r)
    if len(result) != EXPECTED_ROWS:
        raise ValueError("Se esperaban %s centros y hay %s" % (EXPECTED_ROWS,len(result)))
    return result, actual_hash

def api(method, base, token, endpoint, rows=None, prefer=None):
    headers = {"apikey":token, "Authorization":"Bearer "+token,
               "Accept":"application/json"}
    if prefer:
        headers["Prefer"] = prefer
    body = None
    if rows is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = Request(base+endpoint, data=body, headers=headers, method=method)
    for attempt in range(4):
        try:
            with urlopen(req, timeout=30) as response:
                data = response.read()
                return response.headers, (json.loads(data) if data else None)
        except HTTPError as error:
            if error.code not in (429,502,503,504) or attempt==3:
                raise RuntimeError("Error HTTP %s al acceder a la tabla" % error.code) from error
            time.sleep(2**attempt)
        except URLError as error:
            if attempt == 3:
                raise RuntimeError("No hay conexión con Supabase") from error
            time.sleep(2**attempt)
    raise RuntimeError("Error de conexión")

def count(base, token, extra=""):
    headers, _ = api("GET",base,token,
        "/rest/v1/school_directory?select=official_code&limit=1"+extra,
        prefer="count=exact")
    value = headers.get("Content-Range","").rsplit("/",1)
    if len(value) != 2 or not value[1].isdigit():
        raise RuntimeError("No se pudo comprobar el recuento exacto")
    return int(value[1])

def import_csv(path, digest, apply=False, project_ref=None):
    rows, actual = validate(Path(path),digest)
    summary = {"mode":"apply" if apply else "dry-run",
       "validated":len(rows), "sha256":actual, "batch_size":BATCH_SIZE,
       "batches":(len(rows)+BATCH_SIZE-1)//BATCH_SIZE,
       "published_by_import":0, "operational_schools_created":0}
    if not apply:
        return summary
    if (project_ref != PROJECT_REF or
        os.getenv("WETUDY_DIRECTORY_IMPORT_APPROVED") != "SI_AUTORIZO_IMPORTACION_NACIONAL"):
        raise RuntimeError("Falta la aprobación explícita o referencia de proyecto correcta")
    base = os.getenv("SUPABASE_URL","").rstrip("/")
    token = os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
    parsed = urlparse(base)
    if (parsed.scheme != "https" or parsed.hostname != PROJECT_REF+".supabase.co"
        or parsed.port not in (None,443) or parsed.username or parsed.password
        or parsed.path or parsed.query or not token):
        raise RuntimeError("URL o credenciales Supabase inválidas")
    if count(base,token,"&is_listed=eq.true") != 0:
        raise RuntimeError("Ya hay registros publicados; revisar antes de importar")
    before = count(base,token)
    print("Importación iniciada. Filas previas:",before,flush=True)
    for offset in range(0,len(rows),BATCH_SIZE):
        api("POST",base,token,
            "/rest/v1/school_directory?on_conflict=official_code",
            rows[offset:offset+BATCH_SIZE],
            prefer="resolution=ignore-duplicates,return=minimal")
        if offset//BATCH_SIZE % 25 == 0:
            print("Lote",offset//BATCH_SIZE+1,flush=True)
    after = count(base,token)
    listed = count(base,token,"&is_listed=eq.true")
    if after < len(rows) or listed:
        raise RuntimeError("Verificación final fallida: %s filas, %s publicadas" %
                           (after,listed))
    summary.update({"before":before,"after":after,"visible_after":listed})
    return summary

if __name__=="__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv",type=Path)
    parser.add_argument("--sha256",required=True)
    parser.add_argument("--apply",action="store_true")
    parser.add_argument("--project-ref",default=None)
    args=parser.parse_args()
    try:
        print(json.dumps(import_csv(args.csv,args.sha256,args.apply,args.project_ref),
                         ensure_ascii=False,indent=2))
    except (OSError,ValueError,RuntimeError) as error:
        print("IMPORTACIÓN DETENIDA:",str(error),file=sys.stderr)
        sys.exit(1)
