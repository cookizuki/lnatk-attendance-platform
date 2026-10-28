-- =============================================================================
-- LNATK 006 — TG is live-only (no viewing / no officer confirmation).
-- Run AFTER 001–005. Safe to run more than once.
-- =============================================================================
BEGIN;

-- A. TG no longer has a "viewing" phase: its entry window closes when the live
--    window closes (Saturday 3:30 PM). Officers can still fix entries afterwards.
UPDATE session_templates SET confirm_viewing = FALSE WHERE session_type = 'TG';

UPDATE sessions
SET confirm_viewing = FALSE,
    entries_close_at = live_closes_at
WHERE session_type = 'TG' AND live_closes_at IS NOT NULL;

-- B. Entries that were waiting for confirmation now simply count.
UPDATE attendance_logs SET confirmed = TRUE WHERE confirmed = FALSE;

-- C. Future TG sessions get the same live-only window.
CREATE OR REPLACE FUNCTION ensure_sessions() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w DATE; t RECORD; d DATE; v_monday DATE;
BEGIN
  v_monday := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Manila')::DATE)::DATE;
  FOR w IN SELECT g::DATE FROM generate_series(v_monday - 56, v_monday + 14, interval '7 days') g LOOP
    FOR t IN SELECT * FROM session_templates LOOP
      d := w + (t.weekday - 1);
      INSERT INTO sessions (session_type, session_date, opens_at, live_closes_at, entries_close_at,
                            confirm_viewing, allowed_statuses)
      VALUES (
        t.session_type, d,
        (d + t.opens_time) AT TIME ZONE 'Asia/Manila',
        CASE WHEN t.live_closes_time IS NULL THEN NULL ELSE (d + t.live_closes_time) AT TIME ZONE 'Asia/Manila' END,
        CASE WHEN t.live_closes_time IS NOT NULL
             THEN (d + t.live_closes_time) AT TIME ZONE 'Asia/Manila'
             ELSE ((d + t.entries_close_after_days + 1)::TIMESTAMP - interval '1 second') AT TIME ZONE 'Asia/Manila' END,
        FALSE, t.allowed_statuses)
      ON CONFLICT (session_type, session_date) WHERE event_name IS NULL DO NOTHING;
    END LOOP;
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION ensure_sessions() TO anon, authenticated;

COMMIT;
