CREATE TABLE "admin_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"actor_staff_id" uuid NOT NULL,
	"scope" varchar(100) NOT NULL,
	"key" varchar(255) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_commands_idempotency_unique" ON "admin_commands" USING btree ("source_id","actor_staff_id","scope","key");