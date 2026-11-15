"""Static P0 contract for elevated service_role marketplace feed route.

This test is NOT HTTP penetration testing and does not certify production.
It prevents obvious regressions until authorized end-to-end checks exist.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
ROUTE=ROOT/"app/api/marketplace/feed/route.ts"
TYPE=ROOT/"lib/types/marketplace.ts"

class FeedPrivacyStaticContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.code=ROUTE.read_text()
        cls.types=TYPE.read_text()

    def test_elevated_query_never_uses_unrestricted_rows(self):
        c=self.code
        self.assertIn("createAdminClient()",c)
        self.assertIn('const FIELDS =',c)
        self.assertNotRegex(c,r'admin\s*\.\s*from\s*\(\s*["\\x27]listings["\\x27]\s*\)\s*\.\s*select\s*\(\s*["\\x27]\*')
        self.assertGreaterEqual(c.count('.eq("status", "available")'),2)
        self.assertGreaterEqual(c.count(".select(FIELDS)"),2)
        self.assertIn("request.url",c)

    def test_no_precise_seller_location_in_feed_response(self):
        c=self.code
        self.assertRegex(c,r'postalCode:\s*null\b')
        self.assertNotRegex(c,r'postalCode\s*:\s*(?:item\.postal_code|seller\?\.postalCode|viewerPostalCode)')
        self.assertIn("approximateDistanceKm(",c)
        self.assertNotIn("lat:",c)
        self.assertNotIn("lng:",c)
        self.assertNotIn("latitude:",c)
        self.assertNotIn("longitude:",c)
        # Forbid spreading raw DB row into public object or raw rows into JSON.
        self.assertNotRegex(c,r'NextResponse\.json\s*\(\s*\{\s*(?:rows|data)\s*[,}]')
        self.assertNotRegex(c,r'return\s*\{\s*\.\.\.item\b')
        self.assertNotRegex(c,r'return\s*\{\s*\.\.\.row\b')

    def test_radius_requires_authenticated_profile_location(self):
        c=self.code
        self.assertIn("supabase.auth.getUser()",c)
        self.assertRegex(c,r'if\s*\(\s*\(radiusKm\s*!==\s*null\s*\|\|\s*nearestNoRadius\)\s*&&\s*!user')
        self.assertIn('.from("profiles").select("postal_code").eq("id", user.id)',c)
        self.assertIn("hasKnownPostalCode(viewerPostalCode)",c)
        self.assertIn("p_postal_code: viewerPostalCode",c)
        self.assertNotIn("params.get(\\"postal_code\\")",c)

    def test_no_public_cache_or_raw_profile_output(self):
        c=self.code
        self.assertIn('Cache-Control": "private, no-store"',c)
        self.assertIn("return NextResponse.json({ listings, hasMore, offset }",c)
        self.assertNotIn("sellerProfiles,",c.split("return NextResponse.json({ listings, hasMore, offset }")[-1])
        self.assertIn("postalCode?: string | null;",self.types)

if __name__=="__main__":
    unittest.main()
