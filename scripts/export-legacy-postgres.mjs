import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import pg from "pg";

const MAX_ROWS_PER_TABLE = 20_000;
const TABLES = ["users", "nodes", "relations", "relationTypes", "relationLists"];
const connectionString = process.env.LEGACY_DATABASE_URL;
const legacyUserTable = process.env.LEGACY_USER_TABLE;
const outputPath = resolve(process.argv[2] || ".migration-private/legacy-export.json");
const manifestPath = resolve(process.argv[3] || ".migration-private/legacy-manifest.json");

if (!connectionString) throw new Error("LEGACY_DATABASE_URL is required");
if (!legacyUserTable || !/^[a-z_][a-z0-9_]*$/.test(legacyUserTable)) {
  throw new Error("LEGACY_USER_TABLE must be a safe PostgreSQL identifier");
}
const parsedUrl = new URL(connectionString);
if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
  throw new Error("LEGACY_DATABASE_URL must be a PostgreSQL URL");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function normalizeDates(_key, value) {
  return typeof value === "bigint" ? Number(value) : value;
}

const queries = {
  users: `select id, username, email, name, picture,
    created_at as "createdAt", settings
    from ${legacyUserTable} order by id`,
  nodes: `select id, version, author_id as "authorId",
    created_at as "createdAt", coalesce(updated_at, created_at) as "updatedAt",
    content::json as content, coalesce(is_public, false) as "isPublic",
    coalesce(is_new_related_objects_public, false) as "isNewRelatedObjectsPublic",
    canonical_relation_id as "canonicalRelationId", is_checked as "isChecked",
    access_mode as "accessMode", coalesce(attributes, '{}'::json) as attributes,
    slug
    from graph_node order by author_id, id`,
  relations: `select id, version, author_id as "authorId",
    created_at as "createdAt", coalesce(updated_at, created_at) as "updatedAt",
    from_id as "fromId", to_id as "toId", relation_type_id as "relationTypeId",
    coalesce(is_public, false) as "isPublic",
    canonical_relation_id as "canonicalRelationId"
    from graph_relation order by author_id, id`,
  relationTypes: `select id, author_id as "authorId", version, label,
    reverse_label as "reverseLabel", coalesce(is_public, false) as "isPublic"
    from relation_type order by author_id, id`,
  relationLists: `select author_id as "authorId", node_id as "nodeId",
    relation_id as "relationId", type, position_int as "positionInt",
    position_frac as "positionFrac", coalesce(is_public, false) as "isPublic"
    from relation_lists order by author_id, node_id, relation_id, type`,
};

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  query_timeout: 35_000,
});

const client = await pool.connect();
try {
  await client.query("begin transaction isolation level repeatable read read only");
  const tables = {};
  for (const table of TABLES) {
    const result = await client.query(queries[table]);
    if (result.rows.length > MAX_ROWS_PER_TABLE) {
      throw new Error(`${table} exceeds the ${MAX_ROWS_PER_TABLE}-row export bound`);
    }
    tables[table] = result.rows;
  }
  await client.query("commit");

  const frozenAt = new Date().toISOString();
  const sourceKey = digest(tables);
  const payload = { contract: "nodebook.legacy-export/v1", sourceKey, frozenAt, tables };
  const manifest = {
    contract: "nodebook.legacy-manifest/v1",
    sourceKey,
    frozenAt,
    tables: Object.fromEntries(TABLES.map((table) => [table, { count: tables[table].length, digest: digest(tables[table]) }])),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, normalizeDates)}\n`, { encoding: "utf8", mode: 0o600 });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify(manifest));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
