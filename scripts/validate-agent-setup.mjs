import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputArg = "config/agent-setup.local.json"] = process.argv.slice(2).filter((arg) => arg !== "--");
const inputPath = resolve(inputArg);
const config = JSON.parse(readFileSync(inputPath, "utf8"));
const rulePresets = JSON.parse(readFileSync(resolve("config/rule-presets.json"), "utf8"));

const BUILTIN_TEMPLATE_IDS = new Set([
  "mihomo-basic",
  "acl4ssr-mihomo",
  "acl4ssr-mihomo-no-emoji",
  "loyalsoldier-whitelist",
  "loyalsoldier-blacklist",
  "ai-streaming-mihomo",
]);
const SUPPORTED_TARGETS = new Set(["mihomo", "stash", "surge", "surge-mac", "surfboard", "loon", "egern", "shadowrocket", "qx", "sing-box", "v2ray", "uri", "json"]);
const SUPPORTED_TEMPLATE_TARGETS = new Set(["mihomo", "stash"]);
const SUPPORTED_RESOLVE_PROVIDERS = new Set(["Google", "Cloudflare", "Ali", "Tencent", "Custom"]);
const ID_PATTERN = /^[a-z0-9_-]{1,64}$/;
const scriptPlugins = loadScriptPlugins();

const errors = [];
const warnings = [];

if (!Array.isArray(config.sources)) errors.push("sources must be an array");
if (!Array.isArray(config.collections)) errors.push("collections must be an array");
if (!Array.isArray(config.templates)) errors.push("templates must be an array");

const sources = array(config.sources);
const collections = array(config.collections);
const templates = array(config.templates);
const filterPresetIds = new Set(array(rulePresets.filters).map((preset) => stringValue(preset.id)).filter(Boolean));

const sourceIds = new Set();
const templateIds = new Set(BUILTIN_TEMPLATE_IDS);
const customTemplateIds = new Set();
const collectionIds = new Set();

validateDeployment(config.deployment);

for (const source of sources) {
  const id = idValue(source.id);
  if (!id) {
    errors.push("sources[].id is required");
    continue;
  }
  validateId(id, `sources.${id}.id`);
  if (sourceIds.has(id)) errors.push(`duplicate source id: ${id}`);
  sourceIds.add(id);

  if (!stringValue(source.name)) errors.push(`sources.${id}.name is required`);
  if (!['remote', 'local'].includes(source.type)) errors.push(`sources.${id}.type must be remote or local`);
  const type = source.type === "local" ? "local" : "remote";
  if (type === "remote" && !stringValue(source.url)) errors.push(`sources.${id}.url is required for remote sources`);
  if (type === "remote" && stringValue(source.url).split(/\r?\n/).map((url) => url.trim()).filter(Boolean).some((url) => !/^https?:\/\//i.test(url))) {
    errors.push(`sources.${id}.url must contain only http(s) URLs`);
  }
  if (type === "local" && !stringValue(source.content)) errors.push(`sources.${id}.content is required for local sources`);
  validateFilterPresetIds(source.filterPresetIds, `sources.${id}.filterPresetIds`);
  validateFilters(source.filters, `sources.${id}.filters`);
}

for (const template of templates) {
  const id = idValue(template.id);
  if (!id) {
    errors.push("templates[].id is required");
    continue;
  }
  validateId(id, `templates.${id}.id`);
  if (!stringValue(template.name)) errors.push(`templates.${id}.name is required`);
  if (BUILTIN_TEMPLATE_IDS.has(id)) errors.push(`templates.${id} cannot override a built-in template`);
  if (customTemplateIds.has(id)) errors.push(`duplicate template id: ${id}`);
  customTemplateIds.add(id);
  templateIds.add(id);
  const target = stringValue(template.target) || "mihomo";
  if (!SUPPORTED_TEMPLATE_TARGETS.has(target)) errors.push(`templates.${id}.target contains unsupported template target: ${target}`);
  if (!object(template.config)) errors.push(`templates.${id}.config must be an object`);
}

for (const collection of collections) {
  const id = idValue(collection.id);
  if (!id) {
    errors.push("collections[].id is required");
    continue;
  }
  validateId(id, `collections.${id}.id`);
  if (collectionIds.has(id)) errors.push(`duplicate collection id: ${id}`);
  collectionIds.add(id);
  if (!stringValue(collection.name)) errors.push(`collections.${id}.name is required`);
  if (!Array.isArray(collection.sourceIds)) errors.push(`collections.${id}.sourceIds must be an array`);

  const ids = array(collection.sourceIds).map(String);
  if (ids.length === 0) warnings.push(`collections.${id}.sourceIds is empty; the collection will include all enabled sources`);
  if (new Set(ids).size !== ids.length) errors.push(`collections.${id}.sourceIds must not contain duplicates`);
  for (const sourceId of ids) {
    validateId(sourceId, `collections.${id}.sourceIds`);
    if (!sourceIds.has(sourceId)) errors.push(`collections.${id}.sourceIds references missing source: ${sourceId}`);
  }

  const templateId = stringValue(collection.templateId) || "acl4ssr-mihomo";
  validateId(templateId, `collections.${id}.templateId`);
  if (!templateIds.has(templateId)) errors.push(`collections.${id}.templateId references missing template: ${templateId}`);
  validateFilterPresetIds(collection.filterPresetIds, `collections.${id}.filterPresetIds`);
  validateFilters(collection.filters, `collections.${id}.filters`);
}

const summary = {
  input: inputArg,
  sources: sources.length,
  collections: collections.length,
  customTemplates: templates.length,
  filterPresets: [...new Set([...sources, ...collections].flatMap((item) => array(item.filterPresetIds).map(String)))],
  sourceIds: [...sourceIds],
  collectionIds: [...collectionIds],
  errors,
  warnings,
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > 0) process.exit(1);

function validateDeployment(deployment) {
  if (deployment === undefined) return;
  if (!object(deployment)) {
    errors.push("deployment must be an object");
    return;
  }

  if (deployment.workerName !== undefined && !stringValue(deployment.workerName)) errors.push("deployment.workerName cannot be empty");
  if (deployment.d1DatabaseName !== undefined && !stringValue(deployment.d1DatabaseName)) errors.push("deployment.d1DatabaseName cannot be empty");
  if (deployment.d1DatabaseId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue(deployment.d1DatabaseId))) {
    errors.push("deployment.d1DatabaseId must be a UUID");
  }
  validateHostname(deployment.adminHostname, "deployment.adminHostname");
  validateHostname(deployment.downloadHostname, "deployment.downloadHostname");
  if (stringValue(deployment.downloadHostname) && !stringValue(deployment.adminHostname)) {
    errors.push("deployment.downloadHostname requires deployment.adminHostname");
  }
  validateToken(deployment.adminToken, "deployment.adminToken");
  validateToken(deployment.downloadToken, "deployment.downloadToken");
  const downloadTargets = array(deployment.downloadTargets).map(String);
  if (new Set(downloadTargets).size !== downloadTargets.length) errors.push("deployment.downloadTargets must not contain duplicates");
  for (const target of downloadTargets) {
    if (!SUPPORTED_TARGETS.has(String(target))) {
      errors.push(`deployment.downloadTargets contains unsupported target: ${target}`);
    }
  }
}

function validateHostname(value, label) {
  const hostname = stringValue(value);
  if (!hostname) return;
  const labels = hostname.split(".");
  const isValid = hostname.length <= 253
    && labels.every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part));
  if (!isValid) {
    errors.push(`${label} must be a valid hostname without scheme, path or port`);
  }
}

function validateToken(value, label) {
  if (value === undefined) return;
  if (stringValue(value).length < 16) errors.push(`${label} must be at least 16 characters`);
}

function validateFilterPresetIds(presetIds, label) {
  for (const presetId of array(presetIds).map(String)) {
    if (!filterPresetIds.has(presetId)) errors.push(`${label} references missing preset: ${presetId}`);
  }
}

function validateFilters(filters, label) {
  let scriptCount = 0;
  for (const [index, filter] of array(filters).entries()) {
    if (!object(filter)) {
      errors.push(`${label}[${index}] must be an object`);
      continue;
    }

    if (!["include", "exclude", "rename", "delete-field", "dedupe", "sort", "regex-sort", "resolve", "flag", "quick", "script"].includes(filter.type)) {
      errors.push(`${label}[${index}].type is unsupported: ${filter.type}`);
      continue;
    }

    if ((filter.type === "include" || filter.type === "exclude" || filter.type === "rename") && !stringValue(filter.pattern)) {
      errors.push(`${label}[${index}].pattern is required for ${filter.type}`);
    }
    if (filter.type === "delete-field" && !stringValue(filter.pattern) && array(filter.patterns).length === 0) {
      errors.push(`${label}[${index}] needs pattern or patterns for delete-field`);
    }
    if (filter.type === "dedupe" && array(filter.fields).length === 0 && !stringValue(filter.field)) {
      errors.push(`${label}[${index}] needs fields or field for dedupe`);
    }
    if (filter.type === "dedupe" && filter.action && !["delete", "rename"].includes(filter.action)) {
      errors.push(`${label}[${index}].action must be delete or rename`);
    }
    if (filter.type === "sort" && filter.direction && !["asc", "desc", "random"].includes(filter.direction)) {
      errors.push(`${label}[${index}].direction must be asc, desc or random`);
    }
    if (filter.type === "regex-sort" && array(filter.expressions).length === 0 && array(filter.patterns).length === 0 && !stringValue(filter.pattern)) {
      errors.push(`${label}[${index}] needs expressions, patterns or pattern for regex-sort`);
    }
    if (filter.type === "regex-sort" && filter.direction && !["asc", "desc", "original"].includes(filter.direction)) {
      errors.push(`${label}[${index}].direction must be asc, desc or original`);
    }
    if (filter.type === "flag" && filter.mode && !["add", "remove"].includes(filter.mode)) {
      errors.push(`${label}[${index}].mode must be add or remove`);
    }
    if (filter.type === "resolve") {
      if (filter.provider && !SUPPORTED_RESOLVE_PROVIDERS.has(filter.provider)) {
        errors.push(`${label}[${index}].provider contains unsupported resolver: ${filter.provider}`);
      }
      if (filter.recordType && !["A", "AAAA"].includes(filter.recordType)) {
        errors.push(`${label}[${index}].recordType must be A or AAAA`);
      }
      if (filter.filter && !["disabled", "removeFailed", "IPOnly", "IPv4Only", "IPv6Only"].includes(filter.filter)) {
        errors.push(`${label}[${index}].filter contains unsupported resolve filter: ${filter.filter}`);
      }
      if (filter.provider === "Custom" && !/^https:\/\//i.test(stringValue(filter.url))) {
        errors.push(`${label}[${index}].url must be an https DoH endpoint when provider is Custom`);
      }
      if (filter.concurrency !== undefined) {
        const concurrency = Number(filter.concurrency);
        if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 12) {
          errors.push(`${label}[${index}].concurrency must be between 1 and 12`);
        }
      }
    }
    if (filter.type === "script") {
      scriptCount += 1;
      const scriptId = stringValue(filter.scriptId);
      const plugin = scriptPlugins.get(scriptId);
      if (!scriptId) errors.push(`${label}[${index}].scriptId is required`);
      else if (!plugin) errors.push(`${label}[${index}].scriptId is not available in this build: ${scriptId}`);
      if (filter.arguments !== undefined && !object(filter.arguments)) errors.push(`${label}[${index}].arguments must be an object`);
      if (plugin && filter.scriptKind && filter.scriptKind !== plugin.kind) errors.push(`${label}[${index}].scriptKind must be ${plugin.kind}`);
      const args = object(filter.arguments) ? filter.arguments : {};
      for (const parameter of array(plugin?.parameters)) {
        const value = args[parameter.key] ?? parameter.default;
        if (parameter.required && (value === undefined || value === null || value === "")) {
          errors.push(`${label}[${index}].arguments.${parameter.key} is required`);
        }
      }
    }
  }
  if (scriptCount > 2) errors.push(`${label} supports at most 2 script actions`);
}

function loadScriptPlugins() {
  const paths = [resolve("config/script-plugins.json"), resolve("config/script-plugins.local.json")].filter(existsSync);
  return new Map(paths.flatMap((path) => array(JSON.parse(readFileSync(path, "utf8")).scripts)).map((plugin) => [stringValue(plugin.id), plugin]));
}

function stringValue(value) {
  if (typeof value === "string") return value.trim();
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function idValue(value) {
  return stringValue(value);
}

function validateId(value, label) {
  if (!ID_PATTERN.test(value)) {
    errors.push(`${label} must use 1-64 lowercase letters, numbers, underscores, or hyphens`);
  }
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
