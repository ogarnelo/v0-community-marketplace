-- PostgreSQL 17 isolated runner only: no production, synthetic temporary relations.
BEGIN;
CREATE TEMP TABLE qa_delete_listings (id int PRIMARY KEY);
CREATE TEMP TABLE qa_delete_photos (
 id int PRIMARY KEY, listing_id int NOT NULL REFERENCES qa_delete_listings(id) ON DELETE CASCADE
);
CREATE TEMP TABLE qa_delete_favorites (
 id int PRIMARY KEY, listing_id int NOT NULL REFERENCES qa_delete_listings(id) ON DELETE CASCADE
);
CREATE TEMP TABLE qa_delete_views (
 id int PRIMARY KEY, listing_id int NOT NULL REFERENCES qa_delete_listings(id) ON DELETE CASCADE
);
CREATE TEMP TABLE qa_delete_restrict (
 id int PRIMARY KEY, listing_id int NOT NULL REFERENCES qa_delete_listings(id) ON DELETE RESTRICT
);
INSERT INTO qa_delete_listings VALUES (1),(2);
INSERT INTO qa_delete_photos VALUES (11,1),(12,2);
INSERT INTO qa_delete_favorites VALUES (21,1),(22,2);
INSERT INTO qa_delete_views VALUES (31,1),(32,2);
INSERT INTO qa_delete_restrict VALUES (41,2);
-- A clean hard delete cascades children in one PostgreSQL operation.
DELETE FROM qa_delete_listings WHERE id=1;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM qa_delete_listings WHERE id=1)
    OR EXISTS(SELECT 1 FROM qa_delete_photos WHERE listing_id=1)
    OR EXISTS(SELECT 1 FROM qa_delete_favorites WHERE listing_id=1)
    OR EXISTS(SELECT 1 FROM qa_delete_views WHERE listing_id=1)
 THEN RAISE EXCEPTION 'NO_GO_DELETE_CASCADE: hard delete incomplete'; END IF;
END $$;
-- If a restrictive relation exists, the DELETE fails atomically: no
-- preliminary independent child deletion must occur in the application.
DO $$
DECLARE rejected bool := false;
BEGIN
 BEGIN
   DELETE FROM qa_delete_listings WHERE id=2;
 EXCEPTION WHEN foreign_key_violation THEN
   rejected := true;
 END;
 IF NOT rejected
    OR (SELECT count(*) FROM qa_delete_listings WHERE id=2) <> 1
    OR (SELECT count(*) FROM qa_delete_photos WHERE listing_id=2) <> 1
    OR (SELECT count(*) FROM qa_delete_favorites WHERE listing_id=2) <> 1
    OR (SELECT count(*) FROM qa_delete_views WHERE listing_id=2) <> 1
    OR (SELECT count(*) FROM qa_delete_restrict WHERE listing_id=2) <> 1
 THEN RAISE EXCEPTION 'NO_GO_DELETE_ROLLBACK: restricted delete destroyed history'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS PG17: CASCADE deletes atomically, RESTRICT preserves all children' AS result;
