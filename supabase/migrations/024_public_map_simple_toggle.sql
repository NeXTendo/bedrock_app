-- ─────────────────────────────────────────────────────────────────────────────
-- 024: Public map simple toggle
--
-- Problem: the public_reports view required BOTH is_public = true AND
--   public_description IS NOT NULL, so reports that hadn't yet gone through
--   the full sanitized-description publish flow were invisible on the map even
--   after being toggled on.
--
-- Changes:
--   1. public_reports view — only requires is_public = true.
--      Description and address fall back to the citizen's originals via COALESCE
--      so the map always has something to show.
--   2. review_report_visibility RPC — unchanged (strict sanitized-description
--      validation stays in place for the Review Queue flow).
--   3. NEW set_report_map_visibility(p_report_id, p_visible) — lightweight RPC
--      that just flips is_public so admins can show/hide a report from the map
--      instantly without touching the sanitized description or photo approvals.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Update public_reports view ────────────────────────────────────────────

DROP VIEW IF EXISTS public.public_reports CASCADE;

CREATE VIEW public.public_reports
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.category_id,
  -- Use sanitized description when available, fall back to citizen's original
  COALESCE(r.public_description, r.description) AS description,
  r.severity,
  r.latitude::numeric AS latitude,
  r.longitude::numeric AS longitude,
  -- Use sanitized area label when available, fall back to original address
  COALESCE(r.public_address, r.address) AS address,
  r.status,
  r.created_at,
  r.updated_at,
  r.resolved_at,
  r.priority,
  r.confirmation_count,
  false AS is_owner,
  jsonb_build_object('name', c.name, 'icon', c.icon, 'color', c.color) AS categories,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                 photo.id,
        'image_url',          photo.image_url,
        'bucket_id',          photo.bucket_id,
        'is_public_approved', photo.is_public_approved,
        'uploaded_at',        photo.uploaded_at,
        'is_primary',         photo.is_primary
      )
      ORDER BY photo.is_primary DESC, photo.uploaded_at
    )
    FROM public.report_photos photo
    WHERE photo.report_id = r.id
      AND photo.is_public_approved
  ), '[]'::jsonb) AS report_photos,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',         history.id,
        'old_status', history.old_status,
        'new_status', history.new_status,
        'changed_at', history.changed_at
      )
      ORDER BY history.changed_at
    )
    FROM public.status_history history
    WHERE history.report_id = r.id
  ), '[]'::jsonb) AS status_history
FROM public.reports r
LEFT JOIN public.categories c ON c.id = r.category_id
-- is_public flag alone controls map visibility (no description requirement)
WHERE r.is_public;

GRANT SELECT ON public.public_reports TO anon, authenticated;


-- ── 2. New lightweight toggle RPC ─────────────────────────────────────────────
-- Flips is_public without touching description or photos.
-- Logged to report_visibility_reviews with decision = 'published' / 'withheld'.

CREATE OR REPLACE FUNCTION public.set_report_map_visibility(
  p_report_id uuid,
  p_visible   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT private.can_review_report(p_report_id) THEN
    RAISE EXCEPTION 'Report is not available for review in your department'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.reports
  SET
    is_public = p_visible,
    visibility_reviewed_at = now(),
    visibility_reviewed_by = auth.uid()
  WHERE id = p_report_id;

  INSERT INTO public.report_visibility_reviews (
    report_id, reviewer_id, decision, note
  )
  VALUES (
    p_report_id,
    auth.uid(),
    CASE WHEN p_visible THEN 'published' ELSE 'withheld' END,
    CASE WHEN p_visible THEN 'Toggled visible on public map' ELSE 'Toggled hidden from public map' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_report_map_visibility(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_report_map_visibility(uuid, boolean)
  TO authenticated;
