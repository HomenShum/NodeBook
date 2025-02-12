UPDATE graph_relation
SET from_id = REPLACE(from_id, 'user-root-id', 'user-stream-id')
WHERE from_id LIKE 'user-root-id-%'
  AND relation_type_id IN ('sublist', 'child')
  AND to_id NOT LIKE '%|%';