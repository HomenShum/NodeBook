CREATE TABLE "canonical_path_cache" (
	"object_id" text PRIMARY KEY NOT NULL,
	"ancestors" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
