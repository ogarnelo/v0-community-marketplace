-- Synthetic PostgreSQL 17 fixture only. Never load into Supabase.
-- Objects are deliberately small but reproduce the relevant live constraints.
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;

-- Only within the disposable PostgreSQL service: model Supabase's existing
-- service_role BYPASSRLS attribute. Client roles retain no bypass.
ALTER ROLE service_role BYPASSRLS;

CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.schools(
 id uuid PRIMARY KEY,
 is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.user_roles(user_id uuid NOT NULL,school_id uuid NOT NULL,role text NOT NULL);
CREATE TABLE public.listings(
 id uuid PRIMARY KEY,
 seller_id uuid NOT NULL,
 school_id uuid,
 status text NOT NULL CHECK(status IN ('available','reserved','sold','archived')),
 listing_type text NOT NULL CHECK(listing_type IN ('sale','donation')),
 price numeric
);
CREATE TABLE public.conversations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid REFERENCES public.listings(id),
 buyer_id uuid REFERENCES public.profiles(id),
 seller_id uuid REFERENCES public.profiles(id),
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.hidden_conversations(conversation_id uuid,user_id uuid);
CREATE TABLE public.listing_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES public.listings(id),
 buyer_id uuid NOT NULL REFERENCES public.profiles(id),
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 offered_price numeric NOT NULL,
 current_amount numeric,
 accepted_amount numeric,
 current_actor text CHECK(current_actor IN ('buyer','seller')),
 rounds_count integer NOT NULL DEFAULT 1,
 status text CHECK(status IN ('pending','countered','accepted','rejected','withdrawn')),
 responded_at timestamptz
);
CREATE TABLE public.listing_offer_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES public.listing_offers(id),
 conversation_id uuid REFERENCES public.conversations(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 actor_role text NOT NULL CHECK(actor_role IN ('buyer','seller')),
 event_type text NOT NULL CHECK(event_type IN ('accepted','offer_created','rejected')),
 amount numeric NOT NULL,round_number integer NOT NULL,
 status_snapshot text NOT NULL
);
CREATE TABLE public.messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid REFERENCES public.conversations(id),
 sender_id uuid REFERENCES public.profiles(id),
 body text
);
CREATE TABLE public.payment_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES public.listings(id),
 conversation_id uuid REFERENCES public.conversations(id),
 offer_id uuid REFERENCES public.listing_offers(id),
 buyer_id uuid NOT NULL REFERENCES public.profiles(id),
 seller_id uuid NOT NULL REFERENCES public.profiles(id),
 school_id uuid REFERENCES public.schools(id),
 amount numeric NOT NULL,
 currency text NOT NULL,status text NOT NULL,provider text NOT NULL,
 buyer_fee_amount numeric,shipping_amount numeric,
 seller_net_amount numeric,shipment_tier text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.school_impact_report_subscriptions(
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 school_id uuid NOT NULL REFERENCES public.schools(id),
 email text NOT NULL,
 enabled boolean NOT NULL,
 day_of_month integer NOT NULL CHECK(day_of_month BETWEEN 1 AND 28),
 last_sent_month text
);

INSERT INTO public.profiles(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.schools(id,is_active) VALUES
 ('33333333-3333-4333-8333-333333333333',true);
INSERT INTO public.user_roles(user_id,school_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333','school_admin');
INSERT INTO public.listings(id,seller_id,school_id,status,listing_type,price)
VALUES
 ('44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','available','sale',15.00),
 ('55555555-5555-4555-8555-555555555555',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333','available','sale',20.00);
INSERT INTO public.school_impact_report_subscriptions(
 id,user_id,school_id,email,enabled,day_of_month,last_sent_month
) VALUES (
 '66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 'synthetic@example.invalid',true,18,NULL
);

-- In the disposable fixture, replicate only the service-role permissions
-- needed by SECURITY INVOKER. This grants nothing to real production roles.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
