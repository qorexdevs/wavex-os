-- WaveX OS — F.4.a — seed the catalog with the four V1 Expert Agents.
--
-- Idempotent via ON CONFLICT DO UPDATE.
-- recipient_public_key is left NULL here — the operator generates the
-- X25519 keypair locally (`pnpm tsx scripts/generate-expert-keypair.ts`)
-- and uploads the public half via a separate migration.

insert into wavex_os.expert_agent_catalog
  (id, display_name, purpose, data_scope, output_types, required_tier, daily_token_cap, prompt_template_path)
values
  (
    'optimizer-v1',
    'WaveX Optimizer',
    'Reads your KPI snapshots and open issue titles. Files one board-level direction per cycle to course-correct toward your meta-goal.',
    array['kpi_snapshots', 'open_issue_titles', 'fleet_status'],
    array['issue_comment', 'new_issue'],
    'founder',
    40000,
    'docs/prompts/optimizer-board-nudge.md'
  ),
  (
    'alignment-v1',
    'WaveX Alignment',
    'Watches KPI deltas vs the Monte Carlo target curve. When drift exceeds threshold, files course-correction directives. Active only when subscribed at Growth+.',
    array['kpi_snapshots', 'kpi_deltas', 'goal', 'monte_carlo_baseline'],
    array['issue_comment', 'new_issue'],
    'growth',
    140000,
    'docs/prompts/alignment-correction.md'
  ),
  (
    'error-handler-v1',
    'WaveX Error Handler',
    'Reads failed run signatures and classifies clusters (adapter drift vs harness regression vs KPI definition error vs environmental). Files recovery comments and escalates true harness regressions to operator. Growth+.',
    array['failed_runs', 'agent_status', 'error_signatures'],
    array['issue_comment', 'new_issue', 'spawn_throttle_call'],
    'growth',
    140000,
    'docs/prompts/error-recovery-triage.md'
  ),
  (
    'concierge-v1',
    'WaveX Concierge',
    'Custom-tier human-in-the-loop. Reads everything (KPI, issues, comments, agent state). Files unrestricted text comments and routes hard cases to a WaveX team member when automated recovery fails.',
    array['kpi_snapshots', 'kpi_deltas', 'open_issue_titles', 'issue_bodies', 'comments', 'agent_status', 'failed_runs', 'error_signatures', 'goal'],
    array['issue_comment', 'new_issue', 'spawn_throttle_call', 'human_escalation'],
    'custom',
    420000,
    'docs/prompts/concierge-response.md'
  )
on conflict (id) do update
  set display_name = excluded.display_name,
      purpose = excluded.purpose,
      data_scope = excluded.data_scope,
      output_types = excluded.output_types,
      required_tier = excluded.required_tier,
      daily_token_cap = excluded.daily_token_cap,
      prompt_template_path = excluded.prompt_template_path,
      updated_at = now();
