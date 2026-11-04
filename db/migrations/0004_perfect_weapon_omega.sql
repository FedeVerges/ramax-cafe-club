ALTER TABLE "point_rule_cache" DROP CONSTRAINT "point_rule_cache_singleton";--> statement-breakpoint
ALTER TABLE "point_rule_cache" DROP CONSTRAINT "point_rule_cache_pkey";--> statement-breakpoint
ALTER TABLE "point_rule_cache" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "point_rule_cache" ADD PRIMARY KEY ("version");
