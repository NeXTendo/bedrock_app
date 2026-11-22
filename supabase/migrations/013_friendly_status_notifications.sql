CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status text;
  v_user_id uuid;
  v_status_label text;
BEGIN
  SELECT status, user_id
  INTO v_old_status, v_user_id
  FROM public.reports
  WHERE id = p_report_id;

  UPDATE public.reports
  SET status = p_new_status,
      updated_at = now(),
      resolved_at = CASE WHEN upper(p_new_status) = 'RESOLVED' THEN now() ELSE NULL END
  WHERE id = p_report_id;

  INSERT INTO public.status_history
    (report_id, old_status, new_status, changed_by, note)
  VALUES
    (p_report_id, v_old_status, p_new_status, auth.uid(), p_note);

  v_status_label := CASE upper(p_new_status)
    WHEN 'NEW' THEN 'New'
    WHEN 'REPORTED' THEN 'Reported'
    WHEN 'VERIFIED' THEN 'Verified'
    WHEN 'ASSIGNED' THEN 'Assigned'
    WHEN 'IN_PROGRESS' THEN 'In progress'
    WHEN 'RESOLVED' THEN 'Resolved'
    WHEN 'REJECTED' THEN 'Rejected'
    ELSE initcap(replace(lower(p_new_status), '_', ' '))
  END;

  INSERT INTO public.notifications
    (user_id, report_id, type, title, body)
  VALUES
    (v_user_id, p_report_id, 'status_change', 'Report status updated', 'Your report is now ' || v_status_label || '.');
END;
$$;
