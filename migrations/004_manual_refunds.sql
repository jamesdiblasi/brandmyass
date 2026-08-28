-- Refunds become a manual decision.
--
-- The automatic path refunded a payment that cleared after somebody had already
-- bid higher — a logo that never went on the ass at all. The owner would rather
-- judge those by hand.
--
-- That only works if they can be FOUND. An automatic refund needs no record;
-- a manual one is invisible without a queue, and an invisible queue is the same
-- thing as not refunding at all. So the webhook now flags instead of paying:
--
--   refund_due_at   the webhook decided this one was never displayed
--   refunded_at     somebody actually gave the money back (already exists)
--
-- Outstanding work is `refund_due_at is not null and refunded_at is null`, which
-- is what `npm run auction:refunds` lists.

alter table bids add column if not exists refund_due_at timestamptz;

create index if not exists bids_refund_due_idx
  on bids (refund_due_at) where refund_due_at is not null and refunded_at is null;
