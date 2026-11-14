-- Local PostgreSQL17 only: independent temporary synthetic payment status tests.
BEGIN;
CREATE TEMP TABLE qa_webhook_payments (
  id integer PRIMARY KEY, status text NOT NULL
);
INSERT INTO qa_webhook_payments VALUES (1,'refunded'),(2,'cancelled'),(3,'processing'),(4,'succeeded');
-- Strict state CAS: a webhook cannot mutate refunded or cancelled rows.
UPDATE qa_webhook_payments SET status='succeeded'
 WHERE id=1 AND status='processing';
UPDATE qa_webhook_payments SET status='succeeded'
 WHERE id=2 AND status='processing';
-- Another process refunds between SELECT and UPDATE; stale CAS must affect zero rows.
UPDATE qa_webhook_payments SET status='refunded' WHERE id=3;
UPDATE qa_webhook_payments SET status='succeeded'
 WHERE id=3 AND status='processing';
-- An async failure must never revert a succeeded payment.
UPDATE qa_webhook_payments SET status='failed'
 WHERE id=4 AND status='processing';
DO $$
BEGIN
 IF (SELECT status FROM qa_webhook_payments WHERE id=1)<>'refunded'
  OR (SELECT status FROM qa_webhook_payments WHERE id=2)<>'cancelled'
  OR (SELECT status FROM qa_webhook_payments WHERE id=3)<>'refunded'
  OR (SELECT status FROM qa_webhook_payments WHERE id=4)<>'succeeded' THEN
  RAISE EXCEPTION 'NO_GO_WEBHOOK_STATUS_REGRESSION';
 END IF;
END $$;
ROLLBACK;
SELECT 'PASS PG17: terminal statuses preserved under stale webhook CAS' AS result;
