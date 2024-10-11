-- Create a relation lists entry for the global root to users relation
INSERT INTO "relation_lists" (
  author_id,
  node_id,
  relation_id,
  pinned,
  position_int,
  position_frac,
  is_public
)
VALUES (
  'global-admin-user-id',
  'global-root-id',
  'global-root-to-users',
  true,
  EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::bigint,
  'a0',
  true
);
