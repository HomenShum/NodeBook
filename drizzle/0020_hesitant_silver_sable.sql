ALTER TABLE "graph_node" ADD COLUMN "canonical_relation_id" text;--> statement-breakpoint
ALTER TABLE "graph_relation" ADD COLUMN "canonical_relation_id" text;--> statement-breakpoint



-- Use a single WITH clause to define all CTEs and perform updates
WITH
-- Gather all relations associated with each node
node_relations AS (
  SELECT from_id AS node_id, id AS relation_id, created_at
  FROM graph_relation
  UNION ALL
  SELECT to_id AS node_id, id AS relation_id, created_at
  FROM graph_relation
),

-- Find the earliest relation for each node
earliest_relations AS (
  SELECT DISTINCT ON (node_id)
    node_id AS object_id,
    relation_id
  FROM node_relations
  ORDER BY node_id, created_at ASC
),

-- Get the relations between users node and the user nodes
user_to_users_node_relations AS (
  SELECT nodes.id AS node_id, gr.id AS relation_id
  FROM graph_node nodes
  LEFT JOIN graph_relation gr ON 
    (gr.from_id = nodes.id OR gr.to_id = nodes.id)
    AND gr.id LIKE 'users-to-user-relation-id-%'
  WHERE nodes.id LIKE 'user-root-id-%'
),

-- Determine the canonical_relation_id for each node
node_canonical_relations AS (
  SELECT
    nodes.id AS node_id,
    CASE 
      WHEN nodes.id = 'global-root-id' THEN NULL
      WHEN nodes.id = 'global-users-id' THEN 'global-root-to-users'
      WHEN nodes.id LIKE 'user-root-id-%' THEN COALESCE(
          ur.relation_id,
          er.relation_id
      )
      ELSE er.relation_id
    END AS canonical_relation_id
  FROM graph_node nodes
  LEFT JOIN earliest_relations er ON er.object_id = nodes.id
  LEFT JOIN user_to_users_node_relations ur ON ur.node_id = nodes.id
),

-- Determine the canonical_relation_id for each relation
relation_canonical_relations AS (
  SELECT
    gr.id AS relation_id,
    er.relation_id AS canonical_relation_id
  FROM graph_relation gr
  LEFT JOIN earliest_relations er ON er.object_id = gr.id
),

-- Update the graph_node table
node_updates AS (
  UPDATE graph_node
  SET canonical_relation_id = ncr.canonical_relation_id
  FROM node_canonical_relations ncr
  WHERE graph_node.id = ncr.node_id
  RETURNING 1  -- Dummy value for completeness
),

-- Step 4: Update the graph_relation table
relation_updates AS (
  UPDATE graph_relation
  SET canonical_relation_id = rcr.canonical_relation_id
  FROM relation_canonical_relations rcr
  WHERE graph_relation.id = rcr.relation_id
  RETURNING 1  -- Dummy value for completeness
)

-- Final SELECT to conclude the CTE chain
SELECT 'Updates completed successfully.' AS message;