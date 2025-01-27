ALTER TABLE "graph_node" ADD COLUMN "content_tsvector" "tsvector";--> statement-breakpoint
CREATE INDEX "content_search_index" ON "graph_node" USING gin ("content_tsvector");
CREATE OR REPLACE FUNCTION update_content_tsvector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tsvector := to_tsvector('english', (
        SELECT string_agg(item->>'value', ' ')
        FROM json_array_elements(NEW.content::json) AS item
        WHERE item->>'type' IN ('text', 'link')
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_content_tsvector
AFTER INSERT OR UPDATE OF content ON graph_node
FOR EACH ROW
EXECUTE FUNCTION update_content_tsvector();
UPDATE graph_node
SET content_tsvector = to_tsvector('english', (
    SELECT string_agg(item->>'value', ' ')
    FROM json_array_elements(content::json) AS item
    WHERE item->>'type' IN ('text', 'link')
));