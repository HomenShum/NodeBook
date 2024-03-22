CREATE TABLE IF NOT EXISTS "graph_relation_type" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"reverse_label" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "graph_relation" ADD CONSTRAINT "graph_relation_type_id_graph_relation_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "graph_relation_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
