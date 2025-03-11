CREATE INDEX "author_id_index" ON "graph_node" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "is_public_index" ON "graph_node" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "author_public_index" ON "graph_node" USING btree ("author_id","is_public");--> statement-breakpoint
CREATE INDEX "relation_author_id_index" ON "graph_relation" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "relation_is_public_index" ON "graph_relation" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "relation_author_public_index" ON "graph_relation" USING btree ("author_id","is_public");--> statement-breakpoint
CREATE INDEX "author_relation_index" ON "relation_lists" USING btree ("author_id","relation_id");--> statement-breakpoint
CREATE INDEX "public_relations_index" ON "relation_lists" USING btree ("is_public","relation_id");