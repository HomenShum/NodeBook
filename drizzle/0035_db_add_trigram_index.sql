ALTER TABLE "graph_node" ADD COLUMN "content_text" text;--> statement-breakpoint
CREATE INDEX "content_search_trgm_index" ON "graph_node" USING GIN ("content_text" gin_trgm_ops);
CREATE OR REPLACE FUNCTION update_content_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content := (
        SELECT string_agg(item->>'value', ' ')
        FROM json_array_elements(NEW.content::json) AS item
        WHERE item->>'type' IN ('text', 'link')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER trigger_update_content_text
AFTER INSERT OR UPDATE OF content ON graph_node
FOR EACH ROW
EXECUTE FUNCTION update_content_text();
UPDATE graph_node
SET content_text = (
    SELECT string_agg(item->>'value', ' ')
    FROM json_array_elements(content::json) AS item
    WHERE item->>'type' IN ('text', 'link')
);