-- Additional indexes for active MVP/admin paths identified by Supabase Performance Advisor.
create index if not exists listings_user_id_idx on public.listings (user_id);
create index if not exists hidden_conversations_conversation_id_idx on public.hidden_conversations (conversation_id);
create index if not exists donation_requests_assigned_to_requester_id_idx on public.donation_requests (assigned_to_requester_id);
create index if not exists donation_requests_approved_by_admin_id_idx on public.donation_requests (approved_by_admin_id);
create index if not exists moderation_flags_user_id_idx on public.moderation_flags (user_id);
create index if not exists moderation_flags_reviewed_by_idx on public.moderation_flags (reviewed_by);
create index if not exists school_access_codes_school_id_idx on public.school_access_codes (school_id);
create index if not exists school_access_codes_created_by_idx on public.school_access_codes (created_by);
create index if not exists user_marketplace_preferences_preferred_school_id_idx on public.user_marketplace_preferences (preferred_school_id);
create index if not exists user_roles_school_id_idx on public.user_roles (school_id);
create index if not exists transaction_reviews_reviewer_id_idx on public.transaction_reviews (reviewer_id);
