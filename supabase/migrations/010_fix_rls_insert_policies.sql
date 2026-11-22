-- Fix RLS policies to allow INSERT in addition to SELECT/UPDATE/DELETE.
-- A policy with only USING covers SELECT/UPDATE/DELETE but NOT INSERT.
-- WITH CHECK is required for INSERT (and the insert-path of upsert).

-- ── user_push_tokens ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.user_push_tokens;

CREATE POLICY "Users can manage their own push tokens"
ON public.user_push_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ── report_follows ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can follow/unfollow reports" ON public.report_follows;

CREATE POLICY "Users can follow/unfollow reports"
ON public.report_follows
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
