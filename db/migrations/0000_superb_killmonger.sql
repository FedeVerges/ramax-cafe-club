CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'mercado_pago', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('recorded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('closed', 'void');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('opening', 'sale', 'sale_reversal', 'adjustment', 'import');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('member', 'employee', 'admin');--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(100) NOT NULL,
	"key" varchar(255) NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"minimum_quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_quantity_non_negative" CHECK ("inventory_balances"."quantity" >= 0),
	CONSTRAINT "inventory_minimum_non_negative" CHECK ("inventory_balances"."minimum_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_ars" integer NOT NULL,
	"status" "payment_status" DEFAULT 'recorded' NOT NULL,
	"refunded_at" timestamp with time zone,
	"refunded_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64),
	"name" varchar(160) NOT NULL,
	"category" varchar(100),
	"description" text,
	"price_ars" integer NOT NULL,
	"tracks_stock" boolean DEFAULT true NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price_ars" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_ars" integer NOT NULL,
	"subtotal_ars" integer NOT NULL,
	"tracks_stock" boolean NOT NULL,
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_price_non_negative" CHECK ("sale_items"."unit_price_ars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "sale_status" DEFAULT 'closed' NOT NULL,
	"total_ars" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"voided_by_user_id" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sale_id" uuid,
	"type" "stock_movement_type" NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "role_name" NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"email" varchar(320) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_by_user_id_users_id_fk" FOREIGN KEY ("refunded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_credentials" ADD CONSTRAINT "internal_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_scope_key_actor_unique" ON "idempotency_keys" USING btree ("scope","key","actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");