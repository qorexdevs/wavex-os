CREATE TABLE IF NOT EXISTS "companies" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "industry" text,
  "owner_user_id" text,
  "state" text DEFAULT 'draft' NOT NULL,
  "pillar_responses" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "slot" text NOT NULL,
  "template_id" text,
  "reports_to_agent_id" text,
  "reports_to_slot" text,
  "tier" integer DEFAULT 3 NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "adapter" text DEFAULT 'claude-code' NOT NULL,
  "model" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
  "heartbeat" text,
  "spawnable" boolean DEFAULT true NOT NULL,
  "owned_kpi_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "spawned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heartbeat_runs" (
  "agent_id" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "key" text NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "salt" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credential_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "action" text NOT NULL,
  "actor_agent_id" text,
  "metadata" jsonb,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_kpis" (
  "company_id" text NOT NULL,
  "kpi_id" text NOT NULL,
  "label" text NOT NULL,
  "direction" text NOT NULL,
  "target_micros" bigint,
  "window_days" text,
  "kpi_owner_agent_id" text,
  "owner_role" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kpi_snapshots" (
  "company_id" text NOT NULL,
  "kpi_name" text NOT NULL,
  "value" bigint NOT NULL,
  "measured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_events" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "agent_id" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "cached_input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "reason_tag" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "assignee_agent_id" text,
  "title" text NOT NULL,
  "body" text,
  "target_kpi" text,
  "estimated_delta" bigint,
  "baseline_snapshot" jsonb,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_comments" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL,
  "author_agent_id" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_outcome_attributions" (
  "id" text PRIMARY KEY NOT NULL,
  "issue_id" text NOT NULL,
  "company_id" text NOT NULL,
  "kpi_id" text NOT NULL,
  "assignee_agent_id" text,
  "baseline_value" bigint,
  "baseline_captured_at" timestamp with time zone,
  "target_delta" bigint,
  "actual_delta" bigint,
  "closing_value" bigint,
  "forecast_error" bigint,
  "attribution_method" text NOT NULL,
  "attributed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_outcome_attributions_issue_id_uniq" ON "task_outcome_attributions" ("issue_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_company_id_idx" ON "agents" ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credentials_company_connector_idx" ON "credentials" ("company_id", "connector_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_kpis_company_kpi_idx" ON "company_kpis" ("company_id", "kpi_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kpi_snapshots_company_kpi_measured_idx" ON "kpi_snapshots" ("company_id", "kpi_name", "measured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_events_company_occurred_idx" ON "cost_events" ("company_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_assignee_idx" ON "issues" ("company_id", "assignee_agent_id");
