ALTER TABLE "graph_node" ADD COLUMN "relation_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "graph_relation" ADD COLUMN "relation_count" integer DEFAULT 0 NOT NULL;
CREATE INDEX "idx_graph_relation_from_id" ON "graph_relation" USING btree ("from_id");
CREATE INDEX "idx_graph_relation_to_id" ON "graph_relation" USING btree ("to_id");
CREATE OR REPLACE FUNCTION update_relation_count()
RETURNS TRIGGER AS $$
DECLARE
    node_id_to_update TEXT;
    node_ids TEXT[];
BEGIN
    IF (TG_OP = 'INSERT') THEN
        node_ids := ARRAY[NEW.from_id, NEW.to_id];
    ELSIF (TG_OP = 'DELETE') THEN
        node_ids := ARRAY[OLD.from_id, OLD.to_id];
    ELSIF (TG_OP = 'UPDATE') THEN
        node_ids := ARRAY[OLD.from_id, OLD.to_id, NEW.from_id, NEW.to_id];
    END IF;

    FOR node_id_to_update IN SELECT DISTINCT unnest(node_ids)
    LOOP
        IF node_id_to_update IS NOT NULL THEN
            UPDATE graph_node
            SET relation_count = (SELECT COUNT(*) FROM graph_relation WHERE from_id = node_id_to_update OR to_id = node_id_to_update)
            WHERE id = node_id_to_update;

            UPDATE graph_relation
            SET relation_count = (SELECT COUNT(*) FROM graph_relation WHERE from_id = node_id_to_update OR to_id = node_id_to_update)
            WHERE id = node_id_to_update;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_relation_count
AFTER INSERT OR DELETE OR UPDATE ON graph_relation
FOR EACH ROW EXECUTE PROCEDURE update_relation_count();

WITH relation_relation_counts AS (
      SELECT
        relation_id,
        COUNT(*) AS count
      FROM (
        SELECT from_id AS relation_id FROM graph_relation WHERE from_id IS NOT NULL
        UNION ALL
        SELECT to_id AS relation_id FROM graph_relation WHERE to_id IS NOT NULL
      ) all_referenced_ids
      GROUP BY relation_id
    )
    UPDATE graph_relation
    SET
      relation_count = COALESCE(rrc.count, 0)
    FROM (
      SELECT id FROM graph_relation
    ) AS target_relations
    LEFT JOIN relation_relation_counts rrc ON target_relations.id = rrc.relation_id
    WHERE graph_relation.id = target_relations.id;

WITH node_relation_counts AS (
      SELECT
        node_id,
        COUNT(*) AS count
      FROM (
        SELECT from_id AS node_id FROM graph_relation WHERE from_id IS NOT NULL
        UNION ALL
        SELECT to_id AS node_id FROM graph_relation WHERE to_id IS NOT NULL
      ) all_relations
      GROUP BY node_id
    )
    UPDATE graph_node
    SET
      relation_count = COALESCE(nrc.count, 0)
    FROM (
      SELECT id FROM graph_node
    ) AS target_nodes
    LEFT JOIN node_relation_counts nrc ON target_nodes.id = nrc.node_id
    WHERE graph_node.id = target_nodes.id;