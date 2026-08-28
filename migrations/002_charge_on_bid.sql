-- Bids are charged in full when placed, not held.
--
-- The original model authorised 20% of the bid and captured it only on a win.
-- The model now is: you pay your bid, your logo goes on, and it comes off when
-- somebody pays more. The money buys the time the logo actually spends there,
-- so being outbid is not refunded.
--
-- That removes three columns and adds two.
--
--   deposit_cents      gone. There is no deposit; amount_cents IS the payment.
--   hold_captured_at   gone. Nothing is captured — the charge is immediate.
--   hold_released_at   becomes refunded_at, which is a narrower thing: the ONE
--                      case where money goes back is a payment confirming after
--                      someone already bid higher, where the logo never went on
--                      at all. Ordinary outbidding never refunds.
--   paid_at            new. When the charge actually cleared, per Stripe.

alter table bids drop column if exists deposit_cents;
alter table bids drop column if exists hold_captured_at;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'bids' and column_name = 'hold_released_at'
  ) then
    alter table bids rename column hold_released_at to refunded_at;
  end if;
end $$;

alter table bids add column if not exists refunded_at timestamptz;
alter table bids add column if not exists paid_at    timestamptz;

-- 'lost' now means "paid, but somebody was already higher, so refunded".
-- Worth being able to find them quickly when reconciling against Stripe.
create index if not exists bids_refunded_idx on bids (refunded_at) where refunded_at is not null;
