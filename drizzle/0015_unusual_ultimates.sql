UPDATE relation_lists SET is_public = true FROM graph_relation WHERE relation_lists.relation_id = graph_relation.id AND graph_relation.is_public = true;

INSERT INTO relation_lists
(id, node_id, relation_id, pinned, position_int , position_frac, author_id, is_public)
SELECT 'e55c0e1a-6a4a-43b5-83a2-6d3173f25d17', 'global-users-id', 'global-root-to-users', false, 1728804849594, 'a0', 'global-admin-user-id', true
WHERE NOT EXISTS (
    SELECT 1
    FROM relation_lists
    WHERE node_id = 'global-users-id'
    AND relation_id = 'global-root-to-users'
    AND pinned = false
);

INSERT INTO relation_lists
(id, node_id, relation_id, pinned, position_int , position_frac, author_id, is_public)
SELECT '02f4e4f6-487e-4b82-b6de-dfef7c2223f9', 'global-root-id', 'global-root-to-users', false, 1725586109289, 'aO', 'global-admin-user-id', true
WHERE NOT EXISTS (
    SELECT 1
    FROM relation_lists
    WHERE node_id = 'global-root-id'
    AND relation_id = 'global-root-to-users'
    AND pinned = false
);