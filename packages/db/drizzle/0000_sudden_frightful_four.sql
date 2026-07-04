CREATE SCHEMA "kiln";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kiln"."datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"entity" text NOT NULL,
	"mode" text DEFAULT 'snapshot' NOT NULL,
	"upsert_key" text,
	"schema" jsonb NOT NULL,
	"source" jsonb NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kiln"."raw_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid,
	"dataset_name" text NOT NULL,
	"entity" text NOT NULL,
	"mode" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kiln"."records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"upsert_key" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kiln"."records" ADD CONSTRAINT "records_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "kiln"."datasets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "datasets_project_name_uq" ON "kiln"."datasets" USING btree ("project","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_dataset_idx" ON "kiln"."records" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_data_gin" ON "kiln"."records" USING gin ("data");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "records_dataset_upsert_uq" ON "kiln"."records" USING btree ("dataset_id","upsert_key") WHERE "kiln"."records"."upsert_key" is not null;