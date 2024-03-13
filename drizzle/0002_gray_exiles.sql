ALTER TABLE "graph_relation" RENAME COLUMN "from" TO "from_id";--> statement-breakpoint
ALTER TABLE "graph_relation" RENAME COLUMN "to" TO "to_id";--> statement-breakpoint
ALTER TABLE "graph_relation" RENAME COLUMN "type" TO "type_id";--> statement-breakpoint
ALTER TABLE "graph_relation" DROP CONSTRAINT "graph_relation_from_graph_node_id_fk";
--> statement-breakpoint
ALTER TABLE "graph_relation" DROP CONSTRAINT "graph_relation_to_graph_node_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_from_id_graph_node_id_fk" FOREIGN KEY ("from_id") REFERENCES "graph_node"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_to_id_graph_node_id_fk" FOREIGN KEY ("to_id") REFERENCES "graph_node"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
