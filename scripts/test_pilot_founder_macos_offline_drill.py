"""No real secrets: OpenSSL-compatible synthetic AES CBC PBKDF2 test."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.padding import PKCS7

HERE=Path(__file__).resolve().parent
SRC=HERE/"pilot-founder-macos-offline-drill.py"

def synthetic_zip(path,plaintext,password="synthetic-secret"):
    salt=b"12345678"
    derive=PBKDF2HMAC(algorithm=SHA256(),length=48,salt=salt,iterations=200000)
    key_iv=derive.derive(password.encode("utf-8"))
    padder=PKCS7(128).padder()
    padded=padder.update(plaintext)+padder.finalize()
    enc=Cipher(algorithms.AES(key_iv[:32]),modes.CBC(key_iv[32:])).encryptor()
    ciphertext=b"Salted__"+salt+enc.update(padded)+enc.finalize()
    with zipfile.ZipFile(path,"w") as archive:
        archive.writestr("wetudy.dump.enc",ciphertext)

class MacOfflineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch("runpy.run_path",return_value={"run":lambda a,b: None,
                 "validate_archive":lambda p:None,"validate":lambda x:None}):
            spec=importlib.util.spec_from_file_location("mac_dr",SRC)
            mod=importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            cls.mod=mod

    def test_aes256_openssl_compatible_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            z=Path(d)/"encrypted.zip";out=Path(d)/"clear"
            body=b"PGDMP"+b"synthetic-data"*1000
            synthetic_zip(z,body)
            self.mod.decrypt_from_zip(z,"wetudy.dump.enc","synthetic-secret",out)
            self.assertEqual(out.read_bytes(),body)

    def test_wrong_password_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            z=Path(d)/"encrypted.zip";out=Path(d)/"clear"
            synthetic_zip(z,b"PGDMP-hello")
            with self.assertRaises(ValueError):
                self.mod.decrypt_from_zip(z,"wetudy.dump.enc","wrong",out)

    def test_plaintext_and_missing_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            z=Path(d)/"encrypted.zip";out=Path(d)/"clear"
            with zipfile.ZipFile(z,"w") as archive:
                archive.writestr("wetudy.dump.enc",b"not encrypted")
            with self.assertRaisesRegex(ValueError,"header"):
                self.mod.decrypt_from_zip(z,"wetudy.dump.enc","pwd",out)
            with self.assertRaisesRegex(ValueError,"Missing"):
                self.mod.decrypt_from_zip(z,"missing","pwd",out)

    def test_offline_privacy_contract(self):
        text=SRC.read_text()
        for token in ("TemporaryDirectory(", "getpass.getpass(",
                      'PREFLIGHT["run"](db_zip,storage_zip)',
                      'STORAGE["validate_archive"]','ACL["validate"]',
                      "NOT_CERTIFIED:"):
            self.assertIn(token,text)
        for token in ("supabase.co","docker run","shell=True",
                      "print(password","requests.post"):
            self.assertNotIn(token,text)

if __name__=="__main__":unittest.main()
