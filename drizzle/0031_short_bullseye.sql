-- In our previous migration we forgot to migrate positions when changing "from_id" from user root to stream root.
-- We revertback "from_id" back to user root for which pinned positions still exists.
UPDATE graph_relation
SET from_id = REPLACE(graph_relation.from_id, 'user-stream-id', 'user-root-id')
FROM relation_lists
WHERE graph_relation.id = relation_lists.relation_id
  AND relation_lists.node_id LIKE 'user-root-id-%'
  AND graph_relation.relation_type_id IN ('sublist', 'child')
  AND graph_relation.to_id NOT LIKE '%|%'
  AND graph_relation.to_id NOT LIKE '%-%'
  AND relation_lists.type = 'pinned';