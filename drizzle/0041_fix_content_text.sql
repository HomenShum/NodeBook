CREATE OR REPLACE FUNCTION update_content_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_text := (  -- Changed from NEW.content to NEW.content_text
        SELECT string_agg(item->>'value', ' ')
        FROM json_array_elements(NEW.content::json) AS item
        WHERE item->>'type' IN ('text', 'link')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_content_text
BEFORE INSERT OR UPDATE OF content ON graph_node  -- Changed from AFTER to BEFORE
FOR EACH ROW
EXECUTE FUNCTION update_content_text();

-- Update existing rows
UPDATE graph_node
SET content_text = (
    SELECT string_agg(item->>'value', ' ')
    FROM json_array_elements(content::json) AS item
    WHERE item->>'type' IN ('text', 'link')
);