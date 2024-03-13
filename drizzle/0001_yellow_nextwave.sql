CREATE TABLE IF NOT EXISTS "graph_node" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "graph_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"from" text,
	"to" text,
	"type" text
);
--> statement-breakpoint
DROP TABLE "users";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_from_graph_node_id_fk" FOREIGN KEY ("from") REFERENCES "graph_node"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_to_graph_node_id_fk" FOREIGN KEY ("to") REFERENCES "graph_node"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
