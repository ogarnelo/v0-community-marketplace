-- WETUDY LOCAL ONLY: synthetic message/participant RLS fixture.
-- Created in disposable Supabase CLI for E2E, never deployed to production.
CREATE TABLE public.qa_pilot_conversations (
 id uuid PRIMARY KEY,
 listing_id uuid NOT NULL,
 buyer_id uuid NOT NULL,
 seller_id uuid NOT NULL,
 school_id uuid NOT NULL
);
CREATE TABLE public.qa_pilot_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.qa_pilot_conversations(id),
 sender_id uuid NOT NULL,
 body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_pilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_pilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_conversations_participants ON public.qa_pilot_conversations
 FOR SELECT TO authenticated USING (
 buyer_id=(select auth.uid()) OR seller_id=(select auth.uid()));
CREATE POLICY qa_messages_participants_read ON public.qa_pilot_messages
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.qa_pilot_conversations c
 WHERE c.id=conversation_id
 AND (c.buyer_id=(select auth.uid()) OR c.seller_id=(select auth.uid())))
);
CREATE POLICY qa_messages_participants_send ON public.qa_pilot_messages
 FOR INSERT TO authenticated WITH CHECK (
 sender_id=(select auth.uid()) AND
 EXISTS(SELECT 1 FROM public.qa_pilot_conversations c
 WHERE c.id=conversation_id
 AND (c.buyer_id=(select auth.uid()) OR c.seller_id=(select auth.uid())))
);
GRANT SELECT ON public.qa_pilot_conversations TO authenticated;
GRANT SELECT,INSERT ON public.qa_pilot_messages TO authenticated;
GRANT SELECT,INSERT ON public.qa_pilot_conversations TO service_role;
GRANT SELECT,INSERT ON public.qa_pilot_messages TO service_role;
NOTIFY pgrst, 'reload schema';
