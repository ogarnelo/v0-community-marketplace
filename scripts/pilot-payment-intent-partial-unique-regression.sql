-- Isolated PostgreSQL 17 regression, temporary synthetic data only.
BEGIN;
CREATE TEMP TABLE qa_payment_intents (
 id int PRIMARY KEY,
 offer_id int,
 status text NOT NULL,
 amount numeric NOT NULL
);
CREATE UNIQUE INDEX qa_payment_intents_offer_unique_idx
 ON qa_payment_intents(offer_id) WHERE offer_id IS NOT NULL;
INSERT INTO qa_payment_intents VALUES(1,501,'succeeded',2500);
DO $$
DECLARE upsert_rejected boolean:=false; duplicate_rejected boolean:=false; changed_rows int:=0;
BEGIN
  -- An ON CONFLICT(offer_id) inference cannot match ONLY a partial index
  -- without a matching predicate, so the old app code cannot be relied on.
  BEGIN
    EXECUTE $unsafe$
      INSERT INTO qa_payment_intents VALUES(2,501,'requires_payment_method',1)
      ON CONFLICT(offer_id) DO UPDATE
        SET status='requires_payment_method', amount=1
    $unsafe$;
  EXCEPTION WHEN invalid_column_reference THEN upsert_rejected:=true;
  END;
  IF NOT upsert_rejected THEN
    RAISE EXCEPTION 'NO_GO: partial index upsert unexpectedly accepted';
  END IF;
  -- Plain INSERT never updates the existing intent, even under retry.
  BEGIN
    INSERT INTO qa_payment_intents VALUES(3,501,'requires_payment_method',1);
  EXCEPTION WHEN unique_violation THEN duplicate_rejected:=true;
  END;
  IF NOT duplicate_rejected THEN
    RAISE EXCEPTION 'NO_GO: duplicate INSERT not rejected';
  END IF;
  -- Race protection: a pending-only UPDATE cannot touch an already-paid row.
  UPDATE qa_payment_intents SET amount=1
  WHERE offer_id=501 AND status='requires_payment_method';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows<>0 THEN
    RAISE EXCEPTION 'NO_GO: pending-only checkout update changed finalized payment';
  END IF;
  IF (SELECT status FROM qa_payment_intents WHERE offer_id=501) <> 'succeeded'
   OR (SELECT amount FROM qa_payment_intents WHERE offer_id=501) <> 2500
   OR (SELECT count(*) FROM qa_payment_intents WHERE offer_id=501) <> 1
  THEN RAISE EXCEPTION 'NO_GO: successful payment was reset'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS PG17: partial unique offer_id rejects inferred UPSERT and duplicate INSERT preserves paid state' AS result;
