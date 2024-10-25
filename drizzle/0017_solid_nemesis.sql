ALTER TABLE "graph_node" RENAME COLUMN "is_bundle" TO "is_note";--> statement-breakpoint
ALTER TABLE "graph_node" ALTER COLUMN "is_note" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "is_note" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "graph_node" DROP COLUMN IF EXISTS "is_zone";