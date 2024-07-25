CREATE TABLE IF NOT EXISTS "mew_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"picture" text,
	"created_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "graph_node" DROP CONSTRAINT "graph_node_pkey";--> statement-breakpoint
ALTER TABLE "graph_node" ALTER COLUMN "is_private" SET DEFAULT true;--> statement-breakpoint

ALTER TABLE "graph_relation" DROP CONSTRAINT "graph_relation_pkey";--> statement-breakpoint
ALTER TABLE "graph_relation" ALTER COLUMN "is_private" SET DEFAULT true;--> statement-breakpoint

ALTER TABLE "relation_type" DROP CONSTRAINT "relation_type_pkey";--> statement-breakpoint

ALTER TABLE "graph_node" ADD COLUMN "pk" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_node" ADD COLUMN "author_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "pk" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "author_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "created_at" timestamp;--> statement-breakpoint
ALTER TABLE "relation_lists" ADD COLUMN "author_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "relation_type" ADD COLUMN "pk" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "relation_type" ADD COLUMN "author_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_node" ADD CONSTRAINT "graph_node_id_author_id_unique" UNIQUE("id","author_id");--> statement-breakpoint
ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_id_author_id_unique" UNIQUE("id","author_id");--> statement-breakpoint
ALTER TABLE "relation_type" ADD CONSTRAINT "relation_type_id_author_id_unique" UNIQUE("id","author_id");