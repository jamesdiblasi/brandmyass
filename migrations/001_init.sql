-- Brand My Ass — auction schema.
--
-- Zone *metadata* (names, pitch copy, geometry) deliberately lives in
-- lib/zones.ts, not here. It is content, it changes with the copywriting, and
-- it has no business being deployed via a migration. What lives here is the
-- mutable state that the code cannot hold: who bid, how much, and when the
-- clock stops.
--
-- All money is integer cents. There is not a single numeric or float column in
-- this file and there should never be one.

create table if not exists auction (
  -- Single-row table. The check constraint is what makes it a singleton.
  id            integer primary key default 1 check (id = 1),
  opens_at      timestamptz not null,
  closes_at     timestamptz not null,
  goal_cents    integer     not null default 0 check (goal_cents >= 0),
  settled_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists zone_state (
  zone_id        text        primary key,
  reserve_cents  integer     not null check (reserve_cents > 0),
  -- Per-zone close time. Starts equal to auction.closes_at and is pushed out
  -- independently by anti-snipe, so a war over The Ravine does not hold the
  -- undercarriages open.
  closes_at      timestamptz not null,
  extensions     integer     not null default 0 check (extensions >= 0),
  settled        boolean     not null default false,
  updated_at     timestamptz not null default now()
);

create table if not exists bids (
  id                       bigserial   primary key,
  zone_id                  text        not null references zone_state (zone_id) on delete cascade,
  amount_cents             integer     not null check (amount_cents > 0),
  deposit_cents            integer     not null check (deposit_cents > 0),

  sponsor_name             text        not null check (length(btrim(sponsor_name)) between 1 and 80),
  sponsor_email            text        not null check (position('@' in sponsor_email) > 1),
  sponsor_url              text,
  logo_url                 text,

  -- pending   : created, card hold not yet authorised
  -- active    : authorised and currently the standing top bid
  -- outbid    : beaten by a higher bid; hold released
  -- lost      : authorised too late to be top bid; hold released
  -- won       : top bid when the zone closed; hold captured
  -- cancelled : abandoned before authorisation, or rejected by the owner
  status                   text        not null default 'pending'
                                       check (status in ('pending','active','outbid','lost','won','cancelled')),

  stripe_payment_intent_id text        unique,
  -- Set when the hold is released or taken, so settlement is idempotent.
  hold_released_at         timestamptz,
  hold_captured_at         timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- The hot path: "what is the standing bid on this zone". Partial index because
-- only one row per zone is ever 'active', so this stays tiny regardless of how
-- many bids the campaign attracts.
create unique index if not exists bids_one_active_per_zone
  on bids (zone_id) where status = 'active';

create index if not exists bids_zone_amount_idx on bids (zone_id, amount_cents desc, id desc);
create index if not exists bids_status_idx      on bids (status);
create index if not exists bids_email_idx       on bids (lower(sponsor_email));

-- Stripe redelivers webhooks. Recording the event id makes replay a no-op
-- rather than a second capture.
create table if not exists webhook_events (
  id           text        primary key,
  type         text        not null,
  received_at  timestamptz not null default now()
);

-- Waitlist for the "let me do this to your arse too" upsell.
create table if not exists waitlist (
  id          bigserial   primary key,
  email       text        not null unique check (position('@' in email) > 1),
  note        text,
  created_at  timestamptz not null default now()
);
