CREATE TABLE IF NOT EXISTS "graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp,
	"content" text,
	"is_bundle" boolean,
	"is_zone" boolean,
	"is_private" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "graph_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"from_id" text,
	"to_id" text,
	"relation_type_id" text,
	"is_private" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relation_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" text,
	"relation_id" text,
	"pinned" boolean,
	"bigint" bigint,
	"position_frac" text,
	CONSTRAINT "relation_lists_node_id_relation_id_pinned_unique" UNIQUE("node_id","relation_id","pinned")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relation_type" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"label" text,
	"reverseLabel" text
);
