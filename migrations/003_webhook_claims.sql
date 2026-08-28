-- Make webhook idempotency survive a process that dies mid-handler.
--
-- The original gate was "insert the event id, and if the insert loses, this is
-- a redelivery — do nothing". That is correct only while the handler either
-- finishes or throws. It is not correct when the process disappears between the
-- insert and the work: an App Service restart, an instance recycle, an OOM.
-- The row is committed, the work never happened, and Stripe's redelivery is
-- answered "already handled". On this site that failure mode is money taken and
-- no logo put on anybody.
--
-- So the row becomes a CLAIM rather than a receipt. `handled_at` is stamped only
-- once the handler has actually finished, and a claim that is stale and still
-- unhandled may be taken over by a later delivery.
--
-- Five minutes is comfortably longer than any handler here can legitimately run
-- (its slowest path is one refund call) and comfortably shorter than Stripe's
-- retry schedule, so a takeover only ever happens after a real death.

alter table webhook_events add column if not exists handled_at timestamptz;

-- Everything already in the table predates the column and did run to completion,
-- so backfill rather than leaving rows that look abandoned and get reprocessed.
update webhook_events set handled_at = received_at where handled_at is null;

-- Finding the stale unfinished claims is the only query that is not by primary
-- key, and it only ever wants the handful that are still open.
create index if not exists webhook_events_unhandled_idx
  on webhook_events (received_at) where handled_at is null;
