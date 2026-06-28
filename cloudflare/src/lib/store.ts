import {
  BUILTIN_TEMPLATE_IDS,
  BUILTIN_TEMPLATES,
  DEFAULT_COLLECTION_ID,
  DEFAULT_SOURCE_ID,
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_TEMPLATE_ID,
} from "./defaults";
import { normalizeTargetAlias } from "./targets";
import type {
  AppSettings,
  AppConfig,
  CollectionRecord,
  FilterRule,
  SourceRecord,
  SubscriptionCollection,
  SubscriptionSource,
  SubStoreEnv,
  SubscriptionTarget,
  TemplateRecord,
} from "../types";

type JsonObject = Record<string, unknown>;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'remote',
  url TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  filters_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '[]',
  template_id TEXT NOT NULL DEFAULT 'mihomo-basic',
  ignore_failed INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'mihomo',
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

`;

type SourceRow = {
  id: string;
  name: string;
  type: string;
  url: string;
  content: string;
  enabled: number;
  filters_json: string;
  meta_json?: string;
  created_at: number;
  updated_at: number;
};

type CollectionRow = {
  id: string;
  name: string;
  source_ids_json: string;
  filters_json: string;
  template_id: string;
  ignore_failed: number;
  enabled: number;
  meta_json?: string;
  created_at: number;
  updated_at: number;
};

type TemplateRow = {
  id: string;
  name: string;
  target: string;
  config_json: string;
  created_at: number;
  updated_at: number;
};

type SettingsRow = {
  id: string;
  value_json: string;
  updated_at: number;
};

const SETTINGS_ID = "default";

export async function ensureSchema(env: SubStoreEnv) {
  const statements = SCHEMA_SQL.split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await env.DB.prepare(`${statement};`).run();
  }
  await migrateSchema(env);
  await seedDefaults(env);
}

export async function getAppConfig(env: SubStoreEnv): Promise<AppConfig> {
  await ensureSchema(env);
  const [sources, collections, templates, settings] = await Promise.all([
    listSources(env),
    listCollections(env),
    listTemplates(env),
    readSettings(env),
  ]);
  return { sources, collections, templates, settings };
}

export async function listSources(env: SubStoreEnv) {
  const rows = await env.DB.prepare("SELECT * FROM sources ORDER BY created_at ASC").all<SourceRow>();
  return rows.results.map(sourceFromRow);
}

export async function sortSources(env: SubStoreEnv, ids: string[]) {
  await ensureSchema(env);
  const now = Date.now();
  const statements = ids.map((id, index) =>
    env.DB.prepare("UPDATE sources SET created_at = ?, updated_at = ? WHERE id = ?").bind(now + index, now, id),
  );
  if (statements.length > 0) await env.DB.batch(statements);
  return listSources(env);
}

export async function upsertSource(env: SubStoreEnv, input: Partial<SourceRecord>) {
  await ensureSchema(env);
  const now = Date.now();
  const id = toId(input.id || input.name || "source");
  const existing = await getSource(env, id);
  const source: SourceRecord = {
    id,
    name: stringValue(input.name, existing?.name || id),
    type: input.type === "local" ? "local" : "remote",
    url: stringValue(input.url, existing?.url || ""),
    content: stringValue(input.content, existing?.content || ""),
    enabled: input.enabled ?? existing?.enabled ?? true,
    filters: normalizeFilters(input.filters || existing?.filters || []),
    meta: normalizeMeta(input.meta, existing?.meta),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO sources (id, name, type, url, content, enabled, filters_json, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       url = excluded.url,
       content = excluded.content,
       enabled = excluded.enabled,
       filters_json = excluded.filters_json,
       meta_json = excluded.meta_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      source.id,
      source.name,
      source.type,
      source.url,
      source.content,
      boolInt(source.enabled),
      JSON.stringify(source.filters),
      JSON.stringify(source.meta),
      source.createdAt,
      source.updatedAt,
    )
    .run();
  return source;
}

export async function getSource(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM sources WHERE id = ?").bind(id).first<SourceRow>();
  return row ? sourceFromRow(row) : undefined;
}

export async function deleteSource(env: SubStoreEnv, id: string) {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM sources WHERE id = ?").bind(id).run();
  return { deleted: true };
}

export async function listCollections(env: SubStoreEnv) {
  const rows = await env.DB.prepare("SELECT * FROM collections ORDER BY created_at ASC").all<CollectionRow>();
  return rows.results.map(collectionFromRow);
}

export async function sortCollections(env: SubStoreEnv, ids: string[]) {
  await ensureSchema(env);
  const now = Date.now();
  const statements = ids.map((id, index) =>
    env.DB.prepare("UPDATE collections SET created_at = ?, updated_at = ? WHERE id = ?").bind(now + index, now, id),
  );
  if (statements.length > 0) await env.DB.batch(statements);
  return listCollections(env);
}

export async function upsertCollection(env: SubStoreEnv, input: Partial<CollectionRecord>) {
  await ensureSchema(env);
  const now = Date.now();
  const id = toId(input.id || input.name || "collection");
  const existing = await getCollection(env, id);
  const collection: CollectionRecord = {
    id,
    name: stringValue(input.name, existing?.name || id),
    sourceIds: stringArray(input.sourceIds || existing?.sourceIds || []),
    filters: normalizeFilters(input.filters || existing?.filters || []),
    templateId: stringValue(input.templateId, existing?.templateId || DEFAULT_TEMPLATE_ID),
    ignoreFailed: input.ignoreFailed ?? existing?.ignoreFailed ?? true,
    enabled: input.enabled ?? existing?.enabled ?? true,
    meta: normalizeMeta(input.meta, existing?.meta),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO collections (id, name, source_ids_json, filters_json, template_id, ignore_failed, enabled, meta_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       source_ids_json = excluded.source_ids_json,
       filters_json = excluded.filters_json,
       template_id = excluded.template_id,
       ignore_failed = excluded.ignore_failed,
       enabled = excluded.enabled,
       meta_json = excluded.meta_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      collection.id,
      collection.name,
      JSON.stringify(collection.sourceIds),
      JSON.stringify(collection.filters),
      collection.templateId,
      boolInt(collection.ignoreFailed),
      boolInt(collection.enabled),
      JSON.stringify(collection.meta),
      collection.createdAt,
      collection.updatedAt,
    )
    .run();
  return collection;
}

export async function getCollection(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM collections WHERE id = ?").bind(id).first<CollectionRow>();
  return row ? collectionFromRow(row) : undefined;
}

export async function deleteCollection(env: SubStoreEnv, id: string) {
  await ensureSchema(env);
  await env.DB.prepare("DELETE FROM collections WHERE id = ?").bind(id).run();
  return { deleted: true };
}

export async function listTemplates(env: SubStoreEnv) {
  const rows = await env.DB.prepare("SELECT * FROM templates ORDER BY created_at ASC").all<TemplateRow>();
  return rows.results.map(templateFromRow);
}

export async function upsertTemplate(env: SubStoreEnv, input: Partial<TemplateRecord>) {
  await ensureSchema(env);
  const now = Date.now();
  const id = toId(input.id || input.name || "template");
  const existing = await getTemplate(env, id);
  const template: TemplateRecord = {
    id,
    name: stringValue(input.name, existing?.name || id),
    target: normalizeTargetValue(input.target || existing?.target || "mihomo"),
    config: parseConfig(input.config || existing?.config || DEFAULT_TEMPLATE_CONFIG),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO templates (id, name, target, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       target = excluded.target,
       config_json = excluded.config_json,
       updated_at = excluded.updated_at`,
  )
    .bind(template.id, template.name, template.target, JSON.stringify(template.config), template.createdAt, template.updatedAt)
    .run();
  return template;
}

export async function getTemplate(env: SubStoreEnv, id: string) {
  const row = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<TemplateRow>();
  return row ? templateFromRow(row) : undefined;
}

export async function deleteTemplate(env: SubStoreEnv, id: string) {
  await ensureSchema(env);
  if (BUILTIN_TEMPLATE_IDS.has(id)) throw new Error("Built-in templates cannot be deleted");
  await env.DB.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
  return { deleted: true };
}

export async function getSettings(env: SubStoreEnv): Promise<AppSettings> {
  await ensureSchema(env);
  return readSettings(env);
}

async function readSettings(env: SubStoreEnv): Promise<AppSettings> {
  const row = await env.DB.prepare("SELECT * FROM app_settings WHERE id = ?").bind(SETTINGS_ID).first<SettingsRow>();
  return normalizeMeta(parseJson(row?.value_json || "{}", {}));
}

export async function updateSettings(env: SubStoreEnv, next: AppSettings) {
  await ensureSchema(env);
  const now = Date.now();
  const current = await readSettings(env);
  const settings = mergeDeep(current, next);
  await env.DB.prepare(
    `INSERT INTO app_settings (id, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
  )
    .bind(SETTINGS_ID, JSON.stringify(settings), now)
    .run();
  return settings;
}

export async function exportStorage(env: SubStoreEnv) {
  const config = await getAppConfig(env);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: config.settings || {},
    sources: config.sources,
    collections: config.collections,
    templates: config.templates.filter((template) => !BUILTIN_TEMPLATE_IDS.has(template.id)),
  };
}

export async function importStorage(env: SubStoreEnv, input: unknown) {
  await ensureSchema(env);
  const payload = normalizeStoragePayload(input);
  await updateSettings(env, payload.settings);
  for (const source of payload.sources) {
    await upsertSource(env, source);
  }
  for (const template of payload.templates) {
    await upsertTemplate(env, template);
  }
  for (const collection of payload.collections) {
    await upsertCollection(env, collection);
  }
  return {
    restored: true,
    sources: payload.sources.length,
    collections: payload.collections.length,
    templates: payload.templates.length,
  };
}

export async function getSubscriptionSources(env: SubStoreEnv): Promise<SubscriptionSource[]> {
  const sources = await listSources(env);
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    content: source.content,
    filters: source.filters,
    enabled: source.enabled,
    meta: source.meta,
  }));
}

export async function getSubscriptionCollection(env: SubStoreEnv, id: string): Promise<SubscriptionCollection | undefined> {
  const collection = await getCollection(env, id);
  if (!collection || !collection.enabled) return undefined;
  return collectionToSubscription(collection);
}

export async function getRoutingTemplate(env: SubStoreEnv, id: string | undefined) {
  const template = await getTemplate(env, id || DEFAULT_TEMPLATE_ID);
  return template ? { id: template.id, name: template.name, target: template.target, config: template.config } : undefined;
}

async function seedDefaults(env: SubStoreEnv) {
  const now = Date.now();
  for (const builtin of BUILTIN_TEMPLATES) {
    const template = await env.DB.prepare("SELECT id FROM templates WHERE id = ?").bind(builtin.id).first<{ id: string }>();
    if (!template) {
      await env.DB.prepare(
        "INSERT INTO templates (id, name, target, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(builtin.id, builtin.name, builtin.target, JSON.stringify(builtin.config), now, now)
        .run();
    }
  }

  const bootstrapContent = env.SUB_STORE_BOOTSTRAP_SOURCE_CONTENT || "";
  if (bootstrapContent) {
    const source = await env.DB.prepare("SELECT id FROM sources WHERE id = ?").bind(DEFAULT_SOURCE_ID).first<{ id: string }>();
    if (!source) {
      await env.DB.prepare(
        "INSERT INTO sources (id, name, type, url, content, enabled, filters_json, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          DEFAULT_SOURCE_ID,
          env.SUB_STORE_BOOTSTRAP_SOURCE_DISPLAY_NAME || "Bootstrap Source",
          "local",
          "",
          bootstrapContent,
          1,
          "[]",
          "{}",
          now,
          now,
        )
        .run();
    }
  }

  const collection = await env.DB.prepare("SELECT id FROM collections WHERE id = ?").bind(DEFAULT_COLLECTION_ID).first<{ id: string }>();
  if (!collection) {
    await env.DB.prepare(
      "INSERT INTO collections (id, name, source_ids_json, filters_json, template_id, ignore_failed, enabled, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(DEFAULT_COLLECTION_ID, "Daily", bootstrapContent ? JSON.stringify([DEFAULT_SOURCE_ID]) : "[]", "[]", DEFAULT_TEMPLATE_ID, 1, 1, "{}", now, now)
      .run();
  }

}

function sourceFromRow(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "local" ? "local" : "remote",
    url: row.url,
    content: row.content,
    enabled: Boolean(row.enabled),
    filters: normalizeFilters(parseJson(row.filters_json, [])),
    meta: normalizeMeta(parseJson(row.meta_json || "{}", {})),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function collectionFromRow(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    sourceIds: stringArray(parseJson(row.source_ids_json, [])),
    filters: normalizeFilters(parseJson(row.filters_json, [])),
    templateId: row.template_id,
    ignoreFailed: Boolean(row.ignore_failed),
    enabled: Boolean(row.enabled),
    meta: normalizeMeta(parseJson(row.meta_json || "{}", {})),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function templateFromRow(row: TemplateRow): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    target: normalizeTargetValue(row.target),
    config: parseConfig(parseJson(row.config_json, DEFAULT_TEMPLATE_CONFIG)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function collectionToSubscription(collection: CollectionRecord): SubscriptionCollection {
  return {
    id: collection.id,
    name: collection.name,
    sourceIds: collection.sourceIds,
    filters: collection.filters,
    templateId: collection.templateId,
    ignoreFailed: collection.ignoreFailed,
    enabled: collection.enabled,
    meta: collection.meta,
  };
}

async function migrateSchema(env: SubStoreEnv) {
  await addColumnIfMissing(env, "sources", "meta_json", "TEXT NOT NULL DEFAULT '{}'");
  await addColumnIfMissing(env, "collections", "meta_json", "TEXT NOT NULL DEFAULT '{}'");
}

async function addColumnIfMissing(env: SubStoreEnv, table: string, column: string, definition: string) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (result.results.some((row) => row.name === column)) return;
  await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

function normalizeFilters(value: unknown): FilterRule[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as FilterRule[]) : [];
}

function normalizeStoragePayload(input: unknown) {
  if (typeof input === "string") {
    return normalizeStoragePayload(parseJson(input, {}));
  }

  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (typeof payload.content === "string") {
    return normalizeStoragePayload(payload.content);
  }

  return {
    settings: normalizeMeta(payload.settings),
    sources: Array.isArray(payload.sources) ? payload.sources.map(normalizeSourceInput).filter(Boolean) as Partial<SourceRecord>[] : [],
    collections: Array.isArray(payload.collections)
      ? payload.collections.map(normalizeCollectionInput).filter(Boolean) as Partial<CollectionRecord>[]
      : [],
    templates: Array.isArray(payload.templates) ? payload.templates.map(normalizeTemplateInput).filter(Boolean) as Partial<TemplateRecord>[] : [],
  };
}

function normalizeSourceInput(input: unknown): Partial<SourceRecord> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const id = stringValue(source.id || source.name, "");
  if (!id) return undefined;
  return {
    id,
    name: stringValue(source.name, id),
    type: source.type === "local" ? "local" : "remote",
    url: stringValue(source.url, ""),
    content: stringValue(source.content, ""),
    enabled: source.enabled !== false,
    filters: normalizeFilters(source.filters),
    meta: normalizeMeta(source.meta),
  };
}

function normalizeCollectionInput(input: unknown): Partial<CollectionRecord> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const collection = input as Record<string, unknown>;
  const id = stringValue(collection.id || collection.name, "");
  if (!id) return undefined;
  return {
    id,
    name: stringValue(collection.name, id),
    sourceIds: stringArray(collection.sourceIds),
    filters: normalizeFilters(collection.filters),
    templateId: stringValue(collection.templateId, DEFAULT_TEMPLATE_ID),
    ignoreFailed: collection.ignoreFailed !== false,
    enabled: collection.enabled !== false,
    meta: normalizeMeta(collection.meta),
  };
}

function normalizeTemplateInput(input: unknown): Partial<TemplateRecord> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const template = input as Record<string, unknown>;
  const id = stringValue(template.id || template.name, "");
  if (!id || BUILTIN_TEMPLATE_IDS.has(id)) return undefined;
  return {
    id,
    name: stringValue(template.name, id),
    target: normalizeTargetValue(template.target),
    config: parseConfig(template.config || {}),
  };
}

function parseConfig(value: unknown) {
  return value && typeof value === "object" ? normalizeMihomoTemplateConfig(value as JsonObject) : BUILTIN_TEMPLATES[0].config;
}

function normalizeMihomoTemplateConfig(input: JsonObject) {
  const output: JsonObject = { ...input };
  copyAlias(output, "mixed-port", "mixedPort");
  copyAlias(output, "allow-lan", "allowLan");
  copyAlias(output, "log-level", "logLevel");
  copyAlias(output, "proxy-groups", "proxyGroups");
  copyAlias(output, "rule-providers", "ruleProviders");
  return output;
}

function copyAlias(input: JsonObject, from: string, to: string) {
  if (input[to] === undefined && input[from] !== undefined) input[to] = input[from];
  delete input[from];
}

function normalizeMeta(input: unknown, fallback: unknown = {}): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as Record<string, unknown>;
  if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) return fallback as Record<string, unknown>;
  return {};
}

function mergeDeep(base: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = mergeDeep(output[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function isPlainObject(input: unknown) {
  return Boolean(input && typeof input === "object" && !Array.isArray(input));
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeTargetValue(value: unknown): SubscriptionTarget {
  return normalizeTargetAlias(value) || "mihomo";
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function boolInt(value: boolean) {
  return value ? 1 : 0;
}

function toId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}
