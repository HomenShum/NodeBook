CREATE TABLE "expansion_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"root_object_id" text NOT NULL,
	"expanded_objects" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expansion_state_root_object_id_unique" UNIQUE("root_object_id")
);
