-- Phase 8 / OPERATIONAL_LAYER.md §4 — the code-engineer-v1 Expert Agent.
-- The advisory->operational expert: it PROPOSES code_change / db_migration
-- injections; the customer's local Git Engineer (Phase 9) implements them.
--
-- Seeded INACTIVE (is_active=false): it has no signing_public_key /
-- recipient_public_key yet. Activation is the operator key ceremony —
-- generate the X25519 + Ed25519 keypairs, store privates in the Keychain,
-- upload the public keys, then flip is_active=true. Until then the Liaison
-- is never served (and could not verify) injections from this catalog id.

insert into wavex_os.expert_agent_catalog
  (id, display_name, purpose, data_scope, output_types, required_tier,
   daily_token_cap, prompt_template_path, is_active)
values (
  'code-engineer-v1',
  'Code Engineer',
  'Proposes exactly one concrete codebase or database change per cycle that removes a real bottleneck or fixes a recurring failure visible in the fleet digest. Proposes only — never writes a raw diff against code it cannot see. The customer''s local Git Engineer implements the proposal as a reviewable PR using the customer''s own GitHub + Supabase credentials; the customer''s code never enters WaveX infrastructure.',
  array['open_issue_titles','error_signatures','failed_runs','fleet_status','kpi_snapshots']::text[],
  array['code_change','db_migration']::text[],
  'growth',
  120000,
  'docs/prompts/code-engineer-proposal.md',
  false
)
on conflict (id) do nothing;
