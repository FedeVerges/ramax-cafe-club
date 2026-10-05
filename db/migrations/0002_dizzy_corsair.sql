-- Fail explicitly for incompatible test data instead of inventing payments or stock.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sales s WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id)) THEN
    RAISE EXCEPTION 'Ventas sin pago: recrear explícitamente la base de prueba o corregir sus datos antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name IN ('employee', 'admin'))) THEN
    RAISE EXCEPTION 'Hay identidades sin perfil laboral: separar datos antes de migrar';
  END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('employee', 'admin');--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email" TO "username";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "method" SET DATA TYPE "public"."payment_method" USING "method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "response" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "request_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sale_number" serial NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_role" "staff_role" DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_unique" UNIQUE("sale_id");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sale_number_unique" UNIQUE("sale_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_quantity_non_negative" CHECK ("inventory_balances"."quantity" >= 0);
--> statement-breakpoint
UPDATE users SET staff_role = 'admin' WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'admin');
--> statement-breakpoint
UPDATE users SET username = lower(trim(username));
--> statement-breakpoint
UPDATE idempotency_keys SET request_hash = repeat('0', 64), expires_at = created_at, response = NULL;
--> statement-breakpoint
ALTER TABLE idempotency_keys ALTER COLUMN request_hash SET NOT NULL;
--> statement-breakpoint
ALTER TABLE idempotency_keys ALTER COLUMN expires_at SET NOT NULL;
--> statement-breakpoint
UPDATE sessions SET revoked_at = now();
