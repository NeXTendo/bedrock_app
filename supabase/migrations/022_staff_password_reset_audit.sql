CREATE TABLE public.staff_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_id uuid NOT NULL,
  department_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = 'password_reset_email_requested'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX staff_security_events_target_created_idx
  ON public.staff_security_events (target_id, created_at DESC);

ALTER TABLE public.staff_security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.staff_security_events TO service_role;
