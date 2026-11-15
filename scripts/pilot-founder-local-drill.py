#!/usr/bin/env python3
"""Local-only WETUDY encrypted backup inspection: no production connections.

Stage 1: run pilot-founder-local-backup-preflight.py first (no passwords).
Stage 2: python3 scripts/pilot-founder-local-drill.py --database-zip ... \
         --storage-zip ... --confirm-decrypt-locally

Prompts for the local encryption password; never accept password CLI arguments.
Decrypts in a temporary private directory and removes all plaintext on exit.
Storage: validates every archive member and restored SHA256 offline.
Database: uses postgres:17 in network-disabled Docker to inspect pg_restore TOC.
TOC inspection is NOT a full DB/Auth/GoTrue restore or a GO certification.
"""
import argparse
from contextlib import redirect_stdout
import getpass
import io
import os
from pathlib import Path
import re
import runpy
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE=Path(__file__).resolve().parent
PREFLIGHT=runpy.run_path(str(HERE/"pilot-founder-local-backup-preflight.py"))
STORAGE=runpy.run_path(str(HERE/"verify-pilot-storage-restore.py"))


def doctor():
    for executable in ("python3","openssl","docker"):
        status="OK" if shutil.which(executable) else "MISSING"
        print(f"LOCAL_TOOL {executable}: {status}")
    if not shutil.which("docker"):
        return False
    try:
        result=subprocess.run(["docker","info","--format","{{.ServerVersion}}"],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=12,check=False)
        ready=result.returncode==0
    except (OSError, subprocess.TimeoutExpired):
        ready=False
    print("DOCKER_ENGINE: "+"READY" if ready else "DOCKER_ENGINE: NOT_READY")
    return bool(shutil.which("openssl")) and ready


def extract_member(archive_path, name, destination):
    # The ZIP was preflight-verified including every member and SHA256.
    with zipfile.ZipFile(archive_path) as z:
        matches=[x for x in z.infolist() if x.filename in (name,"backup/"+name)]
        if len(matches)!=1:
            raise ValueError("Missing or duplicate encrypted file")
        with z.open(matches[0]) as reader, destination.open("xb") as target:
            shutil.copyfileobj(reader,target,length=1024*1024)
    destination.chmod(0o600)


def decrypt(encrypted, plaintext, password):
    env=os.environ.copy()
    env["WETUDY_LOCAL_DR_SECRET"]=password
    try:
        process=subprocess.run(
            ["openssl","enc","-d","-aes-256-cbc","-pbkdf2",
             "-iter","200000","-in",str(encrypted),"-out",str(plaintext),
             "-pass","env:WETUDY_LOCAL_DR_SECRET"],
            env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,timeout=300,check=False)
    finally:
        env.pop("WETUDY_LOCAL_DR_SECRET",None)
    if process.returncode!=0:
        raise ValueError("Decryption failed or incorrect password")
    plaintext.chmod(0o600)


def local_drill(db_zip,storage_zip,password):
    PREFLIGHT["run"](db_zip,storage_zip)
    if not password:
        raise ValueError("Empty decryption password")
    with tempfile.TemporaryDirectory(prefix="wetudy-private-dr-") as temp:
        private=Path(temp)
        private.chmod(0o700)
        db_enc=private/"postgres.enc"
        storage_enc=private/"storage.enc"
        extract_member(db_zip,"wetudy.dump.enc",db_enc)
        extract_member(storage_zip,"wetudy-storage.tar.gz.enc",storage_enc)
        db_dump=private/"wetudy.dump"
        storage_tar=private/"storage.tar.gz"
        decrypt(db_enc,db_dump,password)
        decrypt(storage_enc,storage_tar,password)

        # In-process verification reconstructs each Storage object ONLY inside
        # a separate disposable TemporaryDirectory, then removes it.
        with redirect_stdout(io.StringIO()) as storage_output:
            STORAGE["validate_archive"](str(storage_tar))
        storage_result=storage_output.getvalue().strip()
        if not storage_result.startswith("Storage offline recovery PASS:"):
            raise ValueError("Unexpected Storage verifier result")

        # Read only pg_restore metadata. Never launch postgres with a mounted
        # production dump, never allow networking, and never print private rows.
        proc=subprocess.run([
            "docker","run","--rm","--network","none",
            "--mount",f"type=bind,source={private},target=/private,readonly",
            "postgres:17","pg_restore","--list","/private/wetudy.dump",
            ],stdin=subprocess.DEVNULL,capture_output=True,text=True,
            timeout=300,check=False)
        if proc.returncode!=0 or len(proc.stdout)<50:
            raise ValueError("Local pg_restore TOC failed (check Docker/Postgres version)")
        toc=proc.stdout
        data=lambda schema,table: bool(re.search(
            r"^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+"+
            re.escape(schema)+r"\s+"+re.escape(table)+r"\s",toc,re.M))
        definitions=lambda schema,table: bool(re.search(
            r"^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+"+
            re.escape(schema)+r"\s+"+re.escape(table)+r"\s",toc,re.M))
        return {
            "postgres_toc_readable":True,
            "auth_users_data_toc":data("auth","users"),
            "auth_identities_data_toc":data("auth","identities"),
            "public_listings_data_toc":data("public","listings"),
            "public_listings_table_toc":definitions("public","listings"),
            "storage_metadata_data_toc":data("storage","objects"),
            "storage_offline_archive_verified":True,
        }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--doctor",action="store_true",
                        help="Check tools and local Docker only, no backups or passwords")
    parser.add_argument("--database-zip",help="Local encrypted PostgreSQL ZIP")
    parser.add_argument("--storage-zip",help="Local encrypted Storage ZIP")
    parser.add_argument("--confirm-decrypt-locally",action="store_true",
                        help="Explicit opt-in: decrypt in private, deleted scratch")
    args=parser.parse_args()
    if args.doctor:
        return 0 if doctor() else 2
    if not args.confirm_decrypt_locally or not args.database_zip or not args.storage_zip:
        parser.error("Provide both ZIPs and --confirm-decrypt-locally")
    try:
        if not doctor():
            raise RuntimeError("Required local Docker/OpenSSL tools unavailable")
        password=getpass.getpass("Local backup encryption password (never share it): ")
        result=local_drill(args.database_zip,args.storage_zip,password)
    except (OSError,ValueError,RuntimeError,zipfile.BadZipFile,
            subprocess.TimeoutExpired) as exc:
        print("NO_GO_LOCAL_DRILL: "+exc.__class__.__name__,file=sys.stderr)
        return 2
    finally:
        if "password" in locals():
            password=None
    print("PASS: encrypted ZIP SHA256 + decrypt + Storage bytes/SHA256 + PostgreSQL dump TOC")
    for key,value in result.items():
        print(key+": "+str(value))
    if not (result["auth_users_data_toc"] and result["auth_identities_data_toc"]):
        print("BLOCKED_AUTH_COVERAGE: Auth users/identities DATA sections not both present.")
    print("NOT_CERTIFIED: full DB/ACL restore, GoTrue authentication, Storage API restore, RTO/RPO.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
