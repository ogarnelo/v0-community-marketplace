"""P0 regression guard for public Next.js APIs; source-level, not HTTP E2E."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class PublicApiDisclosureTests(unittest.TestCase):
    def test_public_school_id_and_search_exclude_test_centres(self):
        c=(ROOT/"app/api/schools/public/route.ts").read_text()
        idbranch=c.split("if (id) {",1)[1].split("let builder =",1)[0]
        search=c.split("let builder =",1)[1]
        for block in (idbranch,search):
            self.assertIn('.eq("is_active", true)', block)
            self.assertIn('.eq("is_test", false)', block)
            self.assertIn('.select("id, name, city")', block)
            self.assertNotIn('postal_code',block)
        self.assertIn('Cache-Control',c)
        self.assertNotIn('.select("*")',c)

    def test_feed_public_error_logging_avoids_raw_database_errors(self):
        c=(ROOT/"app/api/marketplace/feed/route.ts").read_text()
        self.assertIn('console.error("marketplace_feed_read_failed")',c)
        self.assertNotIn('console.error("Error leyendo la siguiente página del marketplace:", error)',c)
        self.assertIn('postalCode: null',c)
        self.assertIn('NextResponse.json({ listings, hasMore, offset }',c)

if __name__=="__main__":
    unittest.main()
