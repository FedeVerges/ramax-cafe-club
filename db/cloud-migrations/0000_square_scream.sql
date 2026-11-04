CREATE TYPE "public"."member_status" AS ENUM('active', 'suspended', 'anonymized');--> statement-breakpoint
CREATE TABLE "cloud_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_sales" (
	"source_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"sale_number" integer NOT NULL,
	"member_id" uuid,
	"total_ars" integer NOT NULL,
	"point_rule_version" integer,
	"pesos_por_punto" integer,
	"points_earned" integer,
	"status" varchar(16) DEFAULT 'closed' NOT NULL,
	"processed_version" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"voided_at" timestamp with time zone,
	CONSTRAINT "cloud_sales_source_id_sale_id_pk" PRIMARY KEY("source_id","sale_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"sale_version" integer NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"result" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_number" varchar(6) NOT NULL,
	"google_sub" varchar(255),
	"display_name" varchar(160),
	"email" varchar(320),
	"phone" varchar(40),
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_number_six_digits" CHECK ("members"."member_number" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "point_allocations" (
	"debit_ledger_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "point_allocations_debit_ledger_id_lot_id_pk" PRIMARY KEY("debit_ledger_id","lot_id"),
	CONSTRAINT "point_allocations_positive" CHECK ("point_allocations"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"cause_key" varchar(255) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"delta" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_ledger_delta_nonzero" CHECK ("point_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "point_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"credit_ledger_id" uuid NOT NULL,
	"original_points" integer NOT NULL,
	"remaining_points" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone,
	CONSTRAINT "point_lots_credit_ledger_id_unique" UNIQUE("credit_ledger_id"),
	CONSTRAINT "point_lots_original_positive" CHECK ("point_lots"."original_points" > 0),
	CONSTRAINT "point_lots_remaining_nonnegative" CHECK ("point_lots"."remaining_points" >= 0),
	CONSTRAINT "point_lots_remaining_bounded" CHECK ("point_lots"."remaining_points" <= "point_lots"."original_points")
);
--> statement-breakpoint
CREATE TABLE "point_rules" (
	"version" integer PRIMARY KEY NOT NULL,
	"pesos_por_punto" integer NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_staff_id" uuid,
	CONSTRAINT "point_rules_value_positive" CHECK ("point_rules"."pesos_por_punto" > 0)
);
--> statement-breakpoint
ALTER TABLE "cloud_sales" ADD CONSTRAINT "cloud_sales_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_debit_ledger_id_point_ledger_id_fk" FOREIGN KEY ("debit_ledger_id") REFERENCES "public"."point_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_allocations" ADD CONSTRAINT "point_allocations_lot_id_point_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."point_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_lots" ADD CONSTRAINT "point_lots_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_lots" ADD CONSTRAINT "point_lots_credit_ledger_id_point_ledger_id_fk" FOREIGN KEY ("credit_ledger_id") REFERENCES "public"."point_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_number_unique" ON "members" USING btree ("member_number");--> statement-breakpoint
CREATE UNIQUE INDEX "members_google_sub_unique" ON "members" USING btree ("google_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "point_ledger_cause_unique" ON "point_ledger" USING btree ("cause_key");