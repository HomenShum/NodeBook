-- Change user root ids to prefix pattern
UPDATE graph_node SET id = 'user-root-id-' || graph_node.author_id WHERE id = 'user-root-id';
UPDATE graph_relation SET from_id = 'user-root-id-' || graph_relation.author_id WHERE from_id = 'user-root-id';
UPDATE graph_relation SET to_id = 'user-root-id-' || graph_relation.author_id WHERE to_id = 'user-root-id';

-- Change global-to-user root relation ids to prefix pattern
UPDATE graph_relation SET id = 'global-to-user-root-relation-id-' || graph_relation.author_id WHERE id = 'global-to-user-root-relation-id';
UPDATE graph_relation SET from_id = 'global-to-user-root-relation-id-' || graph_relation.author_id WHERE from_id = 'global-to-user-root-relation-id';
UPDATE graph_relation SET to_id = 'global-to-user-root-relation-id-' || graph_relation.author_id WHERE to_id = 'global-to-user-root-relation-id';
