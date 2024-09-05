-- Replace relation targets from outline/thoughtstream to user node
UPDATE graph_relation SET from_id = 'user-root-id' WHERE from_id = 'outline-root-id';--> statement-breakpoint
UPDATE graph_relation SET to_id = 'user-root-id' WHERE to_id = 'outline-root-id'; --> statement-breakpoint
UPDATE graph_relation SET from_id = 'user-root-id' WHERE from_id = 'thoughtstream-root-id';--> statement-breakpoint
UPDATE graph_relation SET to_id = 'user-root-id' WHERE to_id = 'thoughtstream-root-id'; --> statement-breakpoint

-- Delete circular relations from and to the user root node
DELETE FROM graph_relation WHERE from_id = 'user-root-id' AND to_id = 'user-root-id'; --> statement-breakpoint

-- Delete all relations to/from the default outline/thoughtstream relations
DELETE FROM graph_relation WHERE from_id = 'outline-to-user-root-relation-id'; --> statement-breakpoint
DELETE FROM graph_relation WHERE to_id = 'outline-to-user-root-relation-id'; --> statement-breakpoint
DELETE FROM graph_relation WHERE from_id = 'thoughtstream-to-user-root-relation-id'; --> statement-breakpoint
DELETE FROM graph_relation WHERE to_id = 'thoughtstream-to-user-root-relation-id'; --> statement-breakpoint

-- Delete the default outline and thoughtstream relations
DELETE FROM graph_relation WHERE id = 'outline-to-user-root-relation-id'; --> statement-breakpoint
DELETE FROM graph_relation WHERE id = 'thoughtstream-to-user-root-relation-id'; --> statement-breakpoint

-- Delete the outline and thoughtstream root nodes
DELETE FROM graph_node WHERE id = 'outline-root-id'; --> statement-breakpoint
DELETE FROM graph_node WHERE id = 'thoughtstream-root-id'; --> statement-breakpoint

-- Update user-root-id node's content
UPDATE graph_node
SET content = '[{"type":"text","value":"' || COALESCE(
    (SELECT name FROM mew_user WHERE mew_user.id = graph_node.author_id),
    (SELECT email FROM mew_user WHERE mew_user.id = graph_node.author_id),
    'Untitled User'
) || '"}]'
WHERE id = 'user-root-id' AND content = '[{"type":"text","value":"User"}]';

