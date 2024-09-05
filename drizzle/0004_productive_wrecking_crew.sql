-- Insert the global root node
INSERT INTO graph_node (id, version, author_id, content, is_private, created_at)
VALUES (
  'global-root-id',
  1,
  'global-admin-user-id',
  '[{"type": "text", "value": "Global Root"}]',
  false,
  '1970-01-01 00:00:00.000'
) ON CONFLICT (id, author_id) DO NOTHING;

-- Insert the global admin user
INSERT INTO mew_user (id, email, name, created_at)
VALUES (
  'global-admin-user-id',
  'support@ideaflow.io',
  'Global Admin',
  '1970-01-01 00:00:00.000'
) ON CONFLICT (id) DO NOTHING;