CREATE SCHEMA IF NOT EXISTS "wavex_os";
--> statement-breakpoint
CREATE TABLE "wavex_os"."product_activation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "product_activation_events_company_user_idx" ON "wavex_os"."product_activation_events" USING btree ("company_id","user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "product_activation_events_event_type_idx" ON "wavex_os"."product_activation_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_activation_events_user_activated_once_idx" ON "wavex_os"."product_activation_events" USING btree ("company_id","user_id") WHERE "wavex_os"."product_activation_events"."event_type" = 'user_activated';