-- Disposable PostgreSQL fixture only. Real function loaded from PR #267 migration.
CREATE TABLE public.user_roles(user_id uuid, role text, school_id uuid);
CREATE TABLE public.agreements(id uuid PRIMARY KEY, status text NOT NULL, disputed_at timestamptz, updated_at timestamptz);
CREATE TABLE public.reports(
 id uuid PRIMARY KEY,reporter_id uuid NOT NULL,target_type text NOT NULL,
 agreement_id uuid,listing_id uuid,conversation_id uuid,status text NOT NULL,
 resolution_note text,resolved_at timestamptz,resolved_by uuid
);
CREATE TABLE public.agreement_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 agreement_id uuid,actor_id uuid,event_type text,note text,metadata jsonb
);
CREATE TABLE public.notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid,kind text,title text,body text,href text,metadata jsonb
);
INSERT INTO public.user_roles VALUES
 ('00000000-0000-4000-8000-000000000101','school_admin','00000000-0000-4000-8000-000000000201'),
 ('00000000-0000-4000-8000-000000000102','super_admin',null);
INSERT INTO public.agreements(id,status) VALUES
 ('00000000-0000-4000-8000-000000000301','disputed');
INSERT INTO public.reports(id,reporter_id,target_type,agreement_id,status) VALUES
 ('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000501',
 'agreement','00000000-0000-4000-8000-000000000301','open');
