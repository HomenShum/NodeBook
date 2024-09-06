ALTER TABLE "graph_node" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "relation_lists" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "relation_type" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "graph_node" DROP COLUMN IF EXISTS "is_private";--> statement-breakpoint
ALTER TABLE "graph_relation" DROP COLUMN IF EXISTS "is_private"; --> statement-breakpoint

-- Make sure global root node is public
UPDATE graph_node SET is_public = 'true' WHERE id = 'global-root-id';