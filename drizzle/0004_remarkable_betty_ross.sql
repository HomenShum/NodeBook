ALTER TABLE "graph_node" ALTER COLUMN "text" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "graph_relation" ALTER COLUMN "from_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_relation" ALTER COLUMN "to_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "graph_relation" ALTER COLUMN "type_id" SET NOT NULL;