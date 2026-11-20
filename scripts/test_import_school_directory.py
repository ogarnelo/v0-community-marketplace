"""Offline import guards: never touches a real Supabase project."""
import csv
from hashlib import sha256
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import import_school_directory as importer

def school(number):
    return dict(official_code=f"{number:08d}",name=f"Centro {number}",
      school_type="CEIP",category="Primaria",address="",municipality="Pontevedra",
      province="Pontevedra",autonomous_community="Galicia",postal_code="36001",
      latitude="",longitude="",source_name="Ministerio",review_status="confirmado")

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.csv=Path(self.tmp.name)/"sample.csv"
        self.rows=[school(i) for i in (1,2,3)]
        self.patch=patch.object(importer,"EXPECTED_ROWS",3)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def save(self,fields=None):
        with self.csv.open("w",encoding="utf-8-sig",newline="") as fh:
            w=csv.DictWriter(fh,fieldnames=fields or importer.FIELDS)
            w.writeheader();w.writerows(self.rows)
        return sha256(self.csv.read_bytes()).hexdigest()

    def test_dry_run_has_no_network(self):
        digest=self.save()
        with patch.object(importer,"api",side_effect=AssertionError("network forbidden")):
            result=importer.import_csv(self.csv,digest)
        self.assertEqual(result["validated"],3)
        self.assertEqual(result["published_by_import"],0)

    def test_wrong_hash_is_rejected(self):
        self.save()
        with self.assertRaisesRegex(ValueError,"SHA-256"):
            importer.import_csv(self.csv,"0"*64)

    def test_duplicate_code_is_rejected(self):
        self.rows[2]["official_code"]=self.rows[0]["official_code"]
        digest=self.save()
        with self.assertRaisesRegex(ValueError,"duplicado"):
            importer.import_csv(self.csv,digest)

    def test_phone_column_is_rejected(self):
        digest=self.save([*importer.FIELDS,"phone"])
        with self.assertRaisesRegex(ValueError,"Cabeceras"):
            importer.import_csv(self.csv,digest)

    def test_bad_community_or_coordinates_are_rejected(self):
        for key,value in (("autonomous_community","Atlántida"),
             ("postal_code","001"),("latitude","60.0")):
            with self.subTest(key=key):
                self.rows=[school(i) for i in (1,2,3)]
                self.rows[0][key]=value
                digest=self.save()
                with self.assertRaises(ValueError):
                    importer.import_csv(self.csv,digest)

    def test_apply_requires_approval_without_calling_network(self):
        digest=self.save()
        with patch.dict(os.environ,{},clear=True):
            with patch.object(importer,"api",side_effect=AssertionError("network forbidden")):
                with self.assertRaisesRegex(RuntimeError,"aprobación"):
                    importer.import_csv(self.csv,digest,apply=True,project_ref=importer.PROJECT_REF)

    def test_approved_import_only_inserts_directory_and_keeps_unlisted(self):
        digest=self.save()
        calls=[]
        class Headers(dict): pass
        def mock_api(method,base,key,endpoint,rows=None,prefer=None):
            calls.append((method,endpoint,rows,prefer))
            if method=="GET":
                return Headers({"Content-Range":"0-0/0" if "is_listed=eq.true" in endpoint else "0-0/3"}),[]
            return Headers({}),None
        env={"WETUDY_DIRECTORY_IMPORT_APPROVED":"SI_AUTORIZO_IMPORTACION_NACIONAL",
           "SUPABASE_URL":"https://"+importer.PROJECT_REF+".supabase.co",
           "SUPABASE_SERVICE_ROLE_KEY":"test-value-not-secret"}
        with patch.dict(os.environ,env,clear=True), patch.object(importer,"api",side_effect=mock_api):
            result=importer.import_csv(self.csv,digest,apply=True,project_ref=importer.PROJECT_REF)
        self.assertEqual(result["after"],3)
        self.assertEqual(result["visible_after"],0)
        writes=[call for call in calls if call[0]=="POST"]
        self.assertEqual(len(writes),1)
        self.assertTrue(all("is_listed" not in r and "linked_school_id" not in r for r in writes[0][2]))
        self.assertIn("ignore-duplicates",writes[0][3])
        self.assertTrue(all("/school_directory" in path for _,path,_,_ in calls))

    def test_published_directory_blocks_import(self):
        digest=self.save()
        env={"WETUDY_DIRECTORY_IMPORT_APPROVED":"SI_AUTORIZO_IMPORTACION_NACIONAL",
           "SUPABASE_URL":"https://"+importer.PROJECT_REF+".supabase.co",
           "SUPABASE_SERVICE_ROLE_KEY":"test-no-network"}
        with patch.dict(os.environ,env,clear=True):
            with patch.object(importer,"count",return_value=1):
                with self.assertRaisesRegex(RuntimeError,"publicados"):
                    importer.import_csv(self.csv,digest,apply=True,project_ref=importer.PROJECT_REF)

if __name__=="__main__":
    unittest.main()
