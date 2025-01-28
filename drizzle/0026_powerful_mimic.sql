DROP TRIGGER trigger_update_content_tsvector ON graph_node;

CREATE TRIGGER trigger_update_content_tsvector
BEFORE INSERT OR UPDATE OF content ON graph_node
FOR EACH ROW
EXECUTE FUNCTION update_content_tsvector();

UPDATE graph_node
SET content_tsvector = to_tsvector('english', (
    SELECT string_agg(item->>'value', ' ')
    FROM json_array_elements(content::json) AS item
    WHERE item->>'type' IN ('text', 'link')
));