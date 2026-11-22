-- RPC function to register/transfer push tokens securely
-- Solves RLS issue where updating a push token already associated with another user fails (USING expression)
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_push_token TEXT,
  p_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_push_tokens (user_id, push_token, platform, updated_at)
  VALUES (auth.uid(), p_push_token, p_platform, NOW())
  ON CONFLICT (push_token)
  DO UPDATE SET
    user_id = auth.uid(),
    platform = EXCLUDED.platform,
    updated_at = NOW();
END;
$$;

