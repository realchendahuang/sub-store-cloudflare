CREATE TABLE IF NOT EXISTS download_grants (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('source', 'collection')),
  resource_id TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_download_grants_token_hash
ON download_grants(token_hash);

CREATE INDEX IF NOT EXISTS idx_download_grants_resource
ON download_grants(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS recycle_bin (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('source', 'collection', 'template', 'share')),
  resource_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  deleted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_deleted_at
ON recycle_bin(deleted_at DESC);
