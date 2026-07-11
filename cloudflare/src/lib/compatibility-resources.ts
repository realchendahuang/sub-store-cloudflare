import { normalizeTargetAlias } from "./targets";
import type { DownloadGrantRecord, RecycleBinRecord, SubscriptionTarget } from "../types";

type GrantRow = {
  id: string;
  token_hash: string;
  resource_type: string;
  resource_id: string;
  target: string;
  expires_at: number | null;
  enabled: number;
  created_at: number;
  updated_at: number;
};

type RecycleRow = {
  id: string;
  resource_type: string;
  resource_id: string;
  snapshot_json: string;
  deleted_at: number;
};

const MAX_RECYCLE_ENTRIES = 50;

export async function createDownloadGrant(
  env: SubStoreEnv,
  input: {
    resourceType: "source" | "collection";
    resourceId: string;
    target?: SubscriptionTarget;
    expiresAt?: number;
  },
) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    `INSERT INTO download_grants
     (id, token_hash, resource_type, resource_id, target, expires_at, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).bind(
    id,
    tokenHash,
    input.resourceType,
    input.resourceId,
    input.target || "",
    input.expiresAt || null,
    now,
    now,
  ).run();
  return { grant: await getDownloadGrant(env, id), token };
}

export async function listDownloadGrants(env: SubStoreEnv) {
  const rows = await env.DB.prepare(
    "SELECT * FROM download_grants ORDER BY created_at DESC",
  ).all<GrantRow>();
  return rows.results.map(grantFromRow);
}

export async function getDownloadGrant(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM download_grants WHERE id = ?")
    .bind(id)
    .first<GrantRow>();
  return row ? grantFromRow(row) : undefined;
}

export async function getDownloadGrantSnapshot(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM download_grants WHERE id = ?")
    .bind(id)
    .first<GrantRow>();
  return row ? { ...grantFromRow(row), tokenHash: row.token_hash } : undefined;
}

export async function updateDownloadGrant(
  env: SubStoreEnv,
  id: string,
  input: { enabled?: boolean; expiresAt?: number | null },
) {
  const existing = await getDownloadGrant(env, id);
  if (!existing) return undefined;
  const enabled = input.enabled ?? existing.enabled;
  const expiresAt = input.expiresAt === undefined ? existing.expiresAt : input.expiresAt || undefined;
  await env.DB.prepare(
    "UPDATE download_grants SET enabled = ?, expires_at = ?, updated_at = ? WHERE id = ?",
  ).bind(enabled ? 1 : 0, expiresAt || null, Date.now(), id).run();
  return getDownloadGrant(env, id);
}

export async function deleteDownloadGrant(env: SubStoreEnv, id: string) {
  await env.DB.prepare("DELETE FROM download_grants WHERE id = ?").bind(id).run();
}

export async function restoreDownloadGrantSnapshot(env: SubStoreEnv, snapshot: Record<string, unknown>) {
  const id = stringValue(snapshot.id);
  const tokenHash = stringValue(snapshot.tokenHash);
  const resourceType = snapshot.resourceType === "collection" ? "collection" : "source";
  const resourceId = stringValue(snapshot.resourceId);
  if (!id || !tokenHash || !resourceId) throw new Error("Share snapshot is invalid");
  const target = normalizeTargetAlias(snapshot.target) || undefined;
  const createdAt = numberValue(snapshot.createdAt) || Date.now();
  await env.DB.prepare(
    `INSERT INTO download_grants
     (id, token_hash, resource_type, resource_id, target, expires_at, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    tokenHash,
    resourceType,
    resourceId,
    target || "",
    numberValue(snapshot.expiresAt) || null,
    snapshot.enabled === false ? 0 : 1,
    createdAt,
    Date.now(),
  ).run();
  return getDownloadGrant(env, id);
}

export async function authorizeScopedDownload(
  env: SubStoreEnv,
  token: string | undefined,
  resourceType: "source" | "collection",
  resourceId: string,
  target: SubscriptionTarget,
) {
  if (!token) return false;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT * FROM download_grants
     WHERE token_hash = ? AND enabled = 1
       AND resource_type = ? AND resource_id = ?
     LIMIT 1`,
  ).bind(tokenHash, resourceType, resourceId).first<GrantRow>();
  if (!row) return false;
  if (row.expires_at && row.expires_at <= Date.now()) return false;
  const restrictedTarget = normalizeTargetAlias(row.target);
  return !restrictedTarget || restrictedTarget === target;
}

export async function archiveResource(
  env: SubStoreEnv,
  resourceType: RecycleBinRecord["resourceType"],
  resourceId: string,
  snapshot: Record<string, unknown>,
) {
  const deletedAt = Date.now();
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO recycle_bin (id, resource_type, resource_id, snapshot_json, deleted_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, resourceType, resourceId, JSON.stringify(snapshot), deletedAt),
    env.DB.prepare(
      `DELETE FROM recycle_bin WHERE id IN (
         SELECT id FROM recycle_bin ORDER BY deleted_at DESC LIMIT -1 OFFSET ?
       )`,
    ).bind(MAX_RECYCLE_ENTRIES),
  ]);
  return { id, resourceType, resourceId, deletedAt };
}

export async function archiveAndDeleteResource(
  env: SubStoreEnv,
  resourceType: RecycleBinRecord["resourceType"],
  resourceId: string,
  snapshot: Record<string, unknown>,
  deleteStatement: D1PreparedStatement,
) {
  const deletedAt = Date.now();
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO recycle_bin (id, resource_type, resource_id, snapshot_json, deleted_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, resourceType, resourceId, JSON.stringify(snapshot), deletedAt),
    deleteStatement,
    env.DB.prepare(
      `DELETE FROM recycle_bin WHERE id IN (
         SELECT id FROM recycle_bin ORDER BY deleted_at DESC LIMIT -1 OFFSET ?
       )`,
    ).bind(MAX_RECYCLE_ENTRIES),
  ]);
  return { id, resourceType, resourceId, deletedAt };
}

export async function listRecycleBin(env: SubStoreEnv) {
  const rows = await env.DB.prepare(
    "SELECT * FROM recycle_bin ORDER BY deleted_at DESC LIMIT ?",
  ).bind(MAX_RECYCLE_ENTRIES).all<RecycleRow>();
  return rows.results.map(recycleFromRow);
}

export async function getRecycleBinEntry(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM recycle_bin WHERE id = ?")
    .bind(id)
    .first<RecycleRow>();
  return row ? recycleFromRow(row) : undefined;
}

export async function deleteRecycleBinEntry(env: SubStoreEnv, id: string) {
  await env.DB.prepare("DELETE FROM recycle_bin WHERE id = ?").bind(id).run();
}

function grantFromRow(row: GrantRow): DownloadGrantRecord {
  return {
    id: row.id,
    resourceType: row.resource_type === "collection" ? "collection" : "source",
    resourceId: row.resource_id,
    target: normalizeTargetAlias(row.target),
    expiresAt: row.expires_at || undefined,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recycleFromRow(row: RecycleRow): RecycleBinRecord {
  const resourceType = ["source", "collection", "template", "share"].includes(row.resource_type)
    ? row.resource_type as RecycleBinRecord["resourceType"]
    : "source";
  return {
    id: row.id,
    resourceType,
    resourceId: row.resource_id,
    snapshot: parseSnapshot(row.snapshot_json),
    deletedAt: row.deleted_at,
  };
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseSnapshot(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
