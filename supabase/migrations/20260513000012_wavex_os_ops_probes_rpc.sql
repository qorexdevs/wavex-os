-- Read-only RPCs exposed via the `public` schema for the operator-side
-- WaveX Ops cycle. The wavex_os schema is not exposed via PostgREST (and
-- shouldn't be — too much surface) but these aggregate probes are safe:
-- they return scalar/small-array data, never raw PII.

-- Last webhook event arrival (used to detect Stripe wiring silence).
CREATE OR REPLACE FUNCTION public.wavex_os_ops_last_webhook_at()
RETURNS TABLE(processed_at timestamptz, type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'wavex_os', 'public'
AS $function$
  SELECT processed_at, type
  FROM wavex_os.stripe_webhook_events
  ORDER BY processed_at DESC
  LIMIT 1;
$function$;

-- Count of active+trialing subscriptions (enough to know if quiet is meaningful).
CREATE OR REPLACE FUNCTION public.wavex_os_ops_active_sub_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'wavex_os', 'public'
AS $function$
  SELECT count(*)::int
  FROM wavex_os.subscriptions
  WHERE status IN ('active', 'trialing');
$function$;

-- Catalog agents + their current active hire count. Empty = ZERO-hire signal.
CREATE OR REPLACE FUNCTION public.wavex_os_ops_catalog_hire_counts()
RETURNS TABLE(catalog_id text, display_name text, active_hires int)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'wavex_os', 'public'
AS $function$
  SELECT c.id, c.display_name,
         (SELECT count(*)::int FROM wavex_os.hired_expert_agents h
          WHERE h.catalog_id = c.id AND h.status = 'active')
  FROM wavex_os.expert_agent_catalog c
  WHERE c.is_active = true;
$function$;

-- Count of recent processing_error rows in stripe_webhook_events (last 24h).
CREATE OR REPLACE FUNCTION public.wavex_os_ops_recent_webhook_errors(p_hours int default 24)
RETURNS TABLE(error_count int, types text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'wavex_os', 'public'
AS $function$
  SELECT count(*)::int,
         array_agg(DISTINCT type)
  FROM wavex_os.stripe_webhook_events
  WHERE processing_error IS NOT NULL
    AND processed_at > (now() - (p_hours || ' hours')::interval);
$function$;

-- Grant execute to service_role (server-side scripts like the ops cycle).
GRANT EXECUTE ON FUNCTION public.wavex_os_ops_last_webhook_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.wavex_os_ops_active_sub_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.wavex_os_ops_catalog_hire_counts() TO service_role;
GRANT EXECUTE ON FUNCTION public.wavex_os_ops_recent_webhook_errors(int) TO service_role;
