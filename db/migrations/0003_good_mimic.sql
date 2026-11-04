CREATE TABLE "member_cache" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"member_number" varchar(6) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"status" varchar(16) NOT NULL,
	"confirmed_balance" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_cache_number_six_digits" CHECK ("member_cache"."member_number" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"sale_version" integer NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_version_positive" CHECK ("outbox_events"."sale_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "point_rule_cache" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"pesos_por_punto" integer NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "point_rule_cache_singleton" CHECK ("point_rule_cache"."id" = 1),
	CONSTRAINT "point_rule_cache_positive" CHECK ("point_rule_cache"."pesos_por_punto" > 0)
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "member_number" varchar(6);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "member_attached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "member_attached_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "point_rule_version" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "pesos_por_punto" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_earned" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_sync_status" varchar(16) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sale_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_cache_number_unique" ON "member_cache" USING btree ("member_number");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_sale_version_unique" ON "outbox_events" USING btree ("sale_id","sale_version");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_member_attached_by_user_id_users_id_fk" FOREIGN KEY ("member_attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;