-- Fix `column reference "company_id" is ambiguous` in
-- wavex_os_record_company_manifest. The previous version used a
-- RETURNS TABLE clause with output columns named `company_id` and
-- `synced_at` — Postgres treats those as implicit pl/pgsql variables
-- in the function body, so when the body references `company_id`
-- (e.g. inside `on conflict (company_id)`) Postgres can't tell
-- whether it's the implicit return variable or the table column.
--
-- Net effect: every customer activation silently 400'd, so manifests
-- never landed in Supabase, so no Mission Control fleet visibility,
-- no Pool C injection trigger, no cross-machine sync. Surfaced by
-- the Tony E2E QA run (docs/qa/2026-05-17/tony-e2e-report.md, P0-4).
--
-- Fix: rename the RETURNS TABLE output columns to non-overlapping
-- names (`out_id`, `out_company_id`, `out_synced_at`). The route
-- caller already destructures by position so the rename is
-- transparent.

create or replace function public.wavex_os_record_company_manifest(
  p_company_id text,
  p_manifest jsonb,
  p_user_id uuid default null,
  p_manifest_sha256 text default null,
  p_goal jsonb default null,
  p_finalized_at timestamptz default null,
  p_signed_at timestamptz default null
)
returns table(out_id uuid, out_company_id text, out_synced_at timestamptz)
language plpgsql
security definer
set search_path to 'wavex_os', 'public'
as $function$
declare
  v_row wavex_os.company_manifests%rowtype;
begin
  insert into wavex_os.company_manifests (
    company_id, user_id, manifest, manifest_sha256, goal,
    finalized_at, signed_at, synced_at
  ) values (
    p_company_id, p_user_id, p_manifest, p_manifest_sha256, p_goal,
    p_finalized_at, p_signed_at, now()
  )
  on conflict (company_id) do update set
    user_id         = coalesce(excluded.user_id, wavex_os.company_manifests.user_id),
    manifest        = excluded.manifest,
    manifest_sha256 = coalesce(excluded.manifest_sha256, wavex_os.company_manifests.manifest_sha256),
    goal            = coalesce(excluded.goal, wavex_os.company_manifests.goal),
    finalized_at    = coalesce(excluded.finalized_at, wavex_os.company_manifests.finalized_at),
    signed_at       = coalesce(excluded.signed_at, wavex_os.company_manifests.signed_at),
    synced_at       = now(),
    updated_at      = now()
  returning * into v_row;

  out_id := v_row.id;
  out_company_id := v_row.company_id;
  out_synced_at := v_row.synced_at;
  return next;
end;
$function$;

-- Re-grant since we re-defined the function.
revoke all on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.wavex_os_record_company_manifest(text, jsonb, uuid, text, jsonb, timestamptz, timestamptz) to service_role;
