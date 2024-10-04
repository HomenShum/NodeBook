-- Add a sublist relation type 
INSERT INTO "relation_type" (id, version, author_id, label, reverse_label, is_public)
VALUES ('sublist', 1, 'global-admin-user-id', 'sublist', 'sublist of', true);

-- Add a public "Users" node
INSERT INTO "graph_node" (id, version, author_id, created_at, content, is_bundle, is_zone, is_public)
VALUES ('global-users-id', 1, 'global-admin-user-id', NOW(), '[{"type": "text", "value": "Users"}]', false, false, true);

-- Create a sublist relation from the global root node to the users node
INSERT INTO "graph_relation" (id, version, author_id, created_at, from_id, to_id, relation_type_id, is_public)
VALUES ('global-root-to-users', 1, 'global-admin-user-id', NOW(), 'global-root-id', 'global-users-id', 'sublist', true);

-- Point user sublist relations to the new users node
UPDATE "graph_relation"
SET "from_id" = 'global-users-id', "id" = CONCAT('users-to-user-relation-id-', "author_id")
WHERE "id" LIKE 'global-to-user-relation-id-%';