#!/usr/bin/env python3
"""Offline local-only SQL drill: school activation links old listings without rewriting them.

This models ONLY the relevant verified PostgreSQL constraints, using fictional
code/IDs in a temporary database. It never reads or writes the hosted project.
"""
import os
import subprocess
from urllib.parse import urlsplit,urlunsplit

SOURCE=os.getenv("LOCAL_DB_URL","")
parsed=urlsplit(SOURCE)
if parsed.scheme not in ("postgresql","postgres") or parsed.hostname not in (
    "localhost","127.0.0.1","::1") or parsed.path!="/postgres":
    raise SystemExit("Refusing non-loopback / unexpected source DB")
NAME="wetudy_qa_directory_bridge"
DEST=urlunsplit((parsed.scheme,parsed.netloc,"/"+NAME,"",""))
SCHOOL="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SCHOOL_OTHER="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

def psql(db,statement,fail=False):
    cp=subprocess.run(["psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
                       "--dbname",db,"-c",statement],
                      text=True,capture_output=True,timeout=25)
    if not fail and cp.returncode:
        raise RuntimeError("QA PostgreSQL query failed")
    if fail and cp.returncode==0:
        raise AssertionError("QA PostgreSQL accepted an invalid association")
    return cp.stdout.strip()

def view_for_operational():
    return psql(DEST,"SELECT count(*) FROM listings WHERE status='available' "
       "AND (school_id='"+SCHOOL+"' OR directory_school_code IN "
       "(SELECT official_code FROM school_directory WHERE linked_school_id='"+
       SCHOOL+"'))")

def view_for_directory():
    return psql(DEST,"SELECT count(*) FROM listings WHERE status='available' "
       "AND (directory_school_code='12345678' OR school_id IN "
       "(SELECT linked_school_id FROM school_directory "
       "WHERE official_code='12345678' AND linked_school_id IS NOT NULL))")

def main():
    if psql(SOURCE,"SELECT count(*) FROM pg_database WHERE datname='"+NAME+"'")!="0":
        raise AssertionError("Refusing to overwrite an existing scratch DB")
    psql(SOURCE,"CREATE DATABASE "+NAME)
    try:
        psql(DEST,"""CREATE TABLE schools (
             id uuid PRIMARY KEY, is_active boolean NOT NULL);
           CREATE TABLE school_directory (
             official_code text PRIMARY KEY CHECK (official_code ~ '^[0-9]{8}$'),
             name text NOT NULL,
             linked_school_id uuid UNIQUE REFERENCES schools(id));
           CREATE TABLE listings (
             id integer PRIMARY KEY, school_id uuid REFERENCES schools(id),
             directory_school_code text REFERENCES school_directory(official_code),
             status text NOT NULL,
             CONSTRAINT single_school_context CHECK
               (school_id IS NULL OR directory_school_code IS NULL));
           INSERT INTO schools VALUES
             ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
             ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
           INSERT INTO school_directory(official_code,name) VALUES
             ('12345678','Colegio ficticio QA'),('87654321','Otro colegio QA');
           INSERT INTO listings VALUES
             (1,null,'12345678','available'),
             (2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'available'),
             (3,null,'87654321','available'),
             (4,null,'12345678','sold');""")
        original=psql(DEST,"SELECT md5(string_agg(row_to_json(l)::text, ',' "
                 "ORDER BY l.id)) FROM listings l")
        if view_for_operational()!="1" or view_for_directory()!="1":
            raise AssertionError("Initial views before activation are not separate")
        psql(DEST,"UPDATE school_directory SET linked_school_id='"+SCHOOL+
                 "' WHERE official_code='12345678' AND linked_school_id IS NULL")
        if view_for_operational()!="2" or view_for_directory()!="2":
            raise AssertionError("Directory+community didn't join old listings")
        if psql(DEST,"SELECT count(*) FROM listings WHERE "
                "directory_school_code='87654321'")!="1":
            raise AssertionError("Unrelated school was affected")
        if psql(DEST,"SELECT md5(string_agg(row_to_json(l)::text, ',' "
                "ORDER BY l.id)) FROM listings l")!=original:
            raise AssertionError("Activation rewrote historical listings")
        psql(DEST,"UPDATE school_directory SET linked_school_id='"+SCHOOL+
             "' WHERE official_code='87654321'",fail=True)
        psql(DEST,"UPDATE school_directory SET linked_school_id="+
             "'cccccccc-cccc-4ccc-8ccc-cccccccccccc' "+
             "WHERE official_code='87654321'",fail=True)
        psql(DEST,"INSERT INTO listings VALUES "
             "(5,'"+SCHOOL+"','12345678','available')",fail=True)
        if psql(DEST,"SELECT is_active::text FROM schools WHERE id='"+
                SCHOOL_OTHER+"'")!="false":
            raise AssertionError("QA linkage inadvertently activated a school")
        print("PASS local directory bridge: historical directory+community ads "
              "co-visible in both school views after explicit link; unrelated "
              "school isolated, duplicate/FK/dual-context mutations rejected.")
        print("LIMIT: synthetic database; approved AMPA, GoTrue and real school "
              "mapping remain unactivated in hosted production.")
    finally:
        psql(SOURCE,"DROP DATABASE IF EXISTS "+NAME+" WITH (FORCE)")

if __name__=="__main__":
    main()
