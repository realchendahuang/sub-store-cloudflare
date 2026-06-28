import request from '@/api';
import { AxiosPromise, AxiosResponse } from 'axios';

type ApiListType = 'sources' | 'collections';
type UiListType = 'subs' | 'collections';
type JsonMap = Record<string, any>;
type UiProcess = {
  id: string;
  type: string;
  args?: any;
  customName?: string;
  disabled?: boolean;
};

const SOURCE_ACTION_TYPES = new Set([
  'Quick Setting Operator',
  'Region Filter',
  'Type Filter',
  'Regex Filter',
  'Flag Operator',
  'Resolve Domain Operator',
  'Regex Sort Operator',
  'Regex Delete Operator',
  'Regex Rename Operator',
  'Handle Duplicate Operator',
  'Sort Operator',
]);
const SUPPORTED_RESOLVE_PROVIDERS = new Set(['Google', 'Cloudflare', 'Ali', 'Tencent', 'Custom']);

const REGION_PATTERNS: Record<string, string> = {
  HK: '香港|港|Hong\\s*Kong|\\bHK\\b',
  TW: '台湾|台灣|Taiwan|\\bTW\\b',
  SG: '新加坡|狮城|獅城|Singapore|\\bSG\\b',
  JP: '日本|东京|東京|大阪|Japan|Tokyo|Osaka|\\bJP\\b',
  UK: '英国|英國|伦敦|倫敦|United\\s*Kingdom|London|\\bUK\\b',
  US: '美国|美國|洛杉矶|洛杉磯|纽约|紐約|United\\s*States|Los\\s*Angeles|New\\s*York|\\bUS\\b|\\bUSA\\b',
  DE: '德国|德國|法兰克福|法蘭克福|Germany|Frankfurt|\\bDE\\b',
  KR: '韩国|韓國|首尔|首爾|Korea|Seoul|\\bKR\\b',
};

const TYPE_FILTER_VALUES = [
  'ss',
  'ssr',
  'vmess',
  'vless',
  'trojan',
  'http',
  'h2-connect',
  'socks5',
  'snell',
  'tuic',
  'hysteria',
  'hysteria2',
  'juicity',
  'mieru',
  'sudoku',
  'masque',
  'anytls',
  'trusttunnel',
  'openvpn',
  'gost-relay',
  'tailscale',
  'wireguard',
  'ssh',
  'external',
  'direct',
];

const TYPE_FILTER_PATTERN_PREFIX = '^(?:';
const TYPE_FILTER_PATTERN_SUFFIX = ')$';

const toApiListType = (type: string): ApiListType => (type === 'collections' || type === 'collection' ? 'collections' : 'sources');
const toUiListType = (type: string): UiListType => (type === 'collections' || type === 'collection' ? 'collections' : 'subs');

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
};

const compactMeta = (data: JsonMap, excluded: string[]) => {
  const excludedSet = new Set(excluded);
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => !excludedSet.has(key) && value !== undefined));
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

const regexUnion = (items: unknown[]): string => {
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map(item => `(?:${item})`)
    .join('|');
};

const escapeRegexLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeResolveProvider = (value: unknown) => {
  const provider = String(value || 'Cloudflare');
  return SUPPORTED_RESOLVE_PROVIDERS.has(provider) ? provider : 'Cloudflare';
};

const exactTypePattern = (items: unknown[]): string => {
  const values = items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map(escapeRegexLiteral);
  return values.length > 0 ? `${TYPE_FILTER_PATTERN_PREFIX}${values.join('|')}${TYPE_FILTER_PATTERN_SUFFIX}` : '';
};

const typeValuesFromPattern = (pattern: unknown): string[] => {
  const text = String(pattern || '');
  if (text.startsWith(TYPE_FILTER_PATTERN_PREFIX) && text.endsWith(TYPE_FILTER_PATTERN_SUFFIX)) {
    return text
      .slice(TYPE_FILTER_PATTERN_PREFIX.length, -TYPE_FILTER_PATTERN_SUFFIX.length)
      .split('|')
      .map(item => item.replace(/\\([.*+?^${}()|[\]\\])/g, '$1'))
      .filter(item => TYPE_FILTER_VALUES.includes(item));
  }
  return [];
};

const normalizeUiProcess = (process: unknown): JsonMap[] => {
  return Array.isArray(process)
    ? process.filter((item): item is JsonMap => Boolean(item) && typeof item === 'object' && !(item as JsonMap).disabled)
    : [];
};

const toActionMeta = (process: unknown): UiProcess[] => {
  return (Array.isArray(process) ? process : [])
    .filter((item): item is JsonMap => Boolean(item) && typeof item === 'object')
    .filter((item) => SOURCE_ACTION_TYPES.has(item.type))
    .map((item) => cloneJson({
      id: item.id || newUiId(),
      type: item.type,
      args: item.args,
      customName: item.customName,
      disabled: item.disabled === true,
    }));
};

const toApiFilters = (process: unknown) => {
  return normalizeUiProcess(process).flatMap((item) => {
    if (['include', 'exclude', 'rename', 'delete-field', 'dedupe', 'sort', 'regex-sort', 'flag', 'quick'].includes(item.type)) {
      const { id, customName, disabled, ...filter } = item;
      return [filter];
    }

    if (item.type === 'Quick Setting Operator') {
      return [{
        type: 'quick',
        ...(item.args && typeof item.args === 'object' ? item.args : {}),
      }];
    }

    if (item.type === 'Region Filter') {
      const values = Array.isArray(item.args?.value) ? item.args.value : Array.isArray(item.args) ? item.args : [];
      const pattern = regexUnion(values.map(value => REGION_PATTERNS[String(value)] || String(value)));
      if (!pattern) return [];
      return [{ type: item.args?.keep === false ? 'exclude' : 'include', field: 'name', pattern }];
    }

    if (item.type === 'Type Filter') {
      const values = Array.isArray(item.args?.value) ? item.args.value : Array.isArray(item.args) ? item.args : [];
      const pattern = exactTypePattern(values);
      if (!pattern) return [];
      return [{ type: item.args?.keep === false ? 'exclude' : 'include', field: 'type', pattern }];
    }

    if (item.type === 'Regex Filter') {
      const regexes = Array.isArray(item.args?.regex) ? item.args.regex : item.args?.regex ? [item.args.regex] : [];
      const pattern = regexUnion(regexes);
      if (!pattern) return [];
      return [{ type: item.args?.keep === false ? 'exclude' : 'include', field: 'name', pattern }];
    }

    if (item.type === 'Regex Delete Operator') {
      const pattern = regexUnion(Array.isArray(item.args) ? item.args : []);
      const patterns = Array.isArray(item.args) ? item.args.map(String).filter(Boolean) : [];
      return pattern ? [{ type: 'delete-field', field: 'name', pattern, patterns }] : [];
    }

    if (item.type === 'Regex Rename Operator') {
      const entries = Array.isArray(item.args) ? item.args : [];
      return entries
        .map(entry => ({
          type: 'rename',
          field: 'name',
          pattern: String(entry?.expr || '').trim(),
          replacement: String(entry?.now || ''),
        }))
        .filter(filter => filter.pattern);
    }

    if (item.type === 'Regex Sort Operator') {
      const expressions = Array.isArray(item.args?.expressions)
        ? item.args.expressions.map(String).filter(Boolean)
        : Array.isArray(item.args)
          ? item.args.map(String).filter(Boolean)
          : [];
      if (expressions.length === 0) return [];
      const direction = ['asc', 'desc', 'original'].includes(item.args?.order) ? item.args.order : 'asc';
      return [{ type: 'regex-sort', expressions, direction }];
    }

    if (item.type === 'Handle Duplicate Operator') {
      const fields = Array.isArray(item.args?.field) && item.args.field.length > 0 ? item.args.field.map(String) : ['name'];
      return [{
        type: 'dedupe',
        fields,
        action: item.args?.action === 'delete' ? 'delete' : 'rename',
        link: item.args?.link || '-',
        position: item.args?.position === 'front' ? 'front' : 'back',
        template: item.args?.template || '0 1 2 3 4 5 6 7 8 9',
      }];
    }

    if (item.type === 'Sort Operator') {
      if (!['asc', 'desc', 'random'].includes(item.args)) return [];
      return [{ type: 'sort', direction: item.args }];
    }

    if (item.type === 'Flag Operator') {
      return [{ type: 'flag', mode: item.args?.mode || 'add', tw: item.args?.tw || 'cn' }];
    }

    if (item.type === 'Resolve Domain Operator') {
      return [{
        type: 'resolve',
        provider: normalizeResolveProvider(item.args?.provider),
        recordType: item.args?.type === 'IPv6' ? 'AAAA' : 'A',
        filter: item.args?.filter || 'disabled',
        url: item.args?.url || '',
        edns: item.args?.edns || '',
        concurrency: item.args?.concurrency || '',
      }];
    }

    return [];
  });
};

const newUiId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, value => value.toString(16).padStart(8, '0')).join('-');
};

const fromApiFilters = (filters: unknown): UiProcess[] => {
  if (!Array.isArray(filters)) return [];

  const output: UiProcess[] = [];
  filters
    .filter((filter): filter is JsonMap => Boolean(filter) && typeof filter === 'object')
    .forEach((filter) => {
      if (filter.type === 'include' || filter.type === 'exclude') {
        if (filter.field === 'type') {
          const typeValues = typeValuesFromPattern(filter.pattern);
          if (typeValues.length > 0) {
            output.push({
              id: newUiId(),
              type: 'Type Filter',
              args: {
                keep: filter.type === 'include',
                value: typeValues,
              },
            });
            return;
          }
        }
        output.push({
          id: newUiId(),
          type: 'Regex Filter',
          args: {
            keep: filter.type === 'include',
            regex: filter.pattern ? [filter.pattern] : [],
          },
        });
        return;
      }

      if (filter.type === 'rename') {
        output.push({
          id: newUiId(),
          type: 'Regex Rename Operator',
          args: filter.pattern ? [{ expr: filter.pattern, now: String(filter.replacement || '') }] : [],
        });
        return;
      }

      if (filter.type === 'delete-field') {
        output.push({
          id: newUiId(),
          type: 'Regex Delete Operator',
          args: Array.isArray(filter.patterns) ? filter.patterns.map(String) : filter.pattern ? [String(filter.pattern)] : [],
        });
        return;
      }

      if (filter.type === 'regex-sort') {
        output.push({
          id: newUiId(),
          type: 'Regex Sort Operator',
          args: {
            order: filter.direction || 'asc',
            expressions: Array.isArray(filter.expressions) ? filter.expressions.map(String) : [],
          },
        });
        return;
      }

      if (filter.type === 'dedupe') {
        output.push({
          id: newUiId(),
          type: 'Handle Duplicate Operator',
          args: {
            action: filter.action === 'delete' ? 'delete' : 'rename',
            link: filter.link || '-',
            position: filter.position === 'front' ? 'front' : 'back',
            template: filter.template || '0 1 2 3 4 5 6 7 8 9',
            field: Array.isArray(filter.fields) ? filter.fields.map(String) : [String(filter.field || 'name')],
          },
        });
        return;
      }

      if (filter.type === 'sort') {
        output.push({
          id: newUiId(),
          type: 'Sort Operator',
          args: filter.direction === 'random' ? 'random' : filter.direction === 'desc' ? 'desc' : 'asc',
        });
        return;
      }

      if (filter.type === 'flag') {
        output.push({
          id: newUiId(),
          type: 'Flag Operator',
          args: {
            mode: filter.mode || 'add',
            tw: filter.tw || 'cn',
          },
        });
        return;
      }

      if (filter.type === 'resolve') {
        output.push({
          id: newUiId(),
          type: 'Resolve Domain Operator',
          args: {
            provider: normalizeResolveProvider(filter.provider),
            type: filter.recordType === 'AAAA' ? 'IPv6' : 'IPv4',
            filter: filter.filter || 'disabled',
            cache: 'disabled',
            url: filter.url || '',
            edns: filter.edns || '',
            concurrency: filter.concurrency || '',
          },
        });
      }

      if (filter.type === 'quick') {
        output.unshift({
          id: newUiId(),
          type: 'Quick Setting Operator',
          args: {
            useless: filter.useless || 'DISABLED',
            udp: filter.udp || 'DEFAULT',
            scert: filter.scert || filter['skip-cert-verify'] || 'DEFAULT',
            tfo: filter.tfo || 'DEFAULT',
            'vmess aead': filter['vmess aead'] || 'DEFAULT',
          },
        });
      }
    });
  return output;
};

const fromApiSource = (source: JsonMap): Sub => {
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
  return {
    ...meta,
    name: source.id,
    displayName: source.name,
    'display-name': source.name,
    source: source.type === 'local' ? 'local' : 'remote',
    url: source.url || '',
    content: source.content || '',
    process: Array.isArray(meta.actions) ? cloneJson(meta.actions) : fromApiFilters(source.filters),
    enabled: source.enabled !== false,
    tag: normalizeTags(meta.tag),
  } as Sub;
};

const toApiSource = (data: JsonMap) => {
  const meta = {
    ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
    actions: toActionMeta(data.process),
    ...compactMeta(data, [
      'id',
      'name',
      'displayName',
      'display-name',
      'source',
      'type',
      'url',
      'content',
      'process',
      'filters',
      'enabled',
      'proxy',
      'mergeSources',
      'firstSubFlow',
      'meta',
    ]),
  };

  return {
    id: data.id || data.name,
    name: data.displayName || data['display-name'] || data.id || data.name,
    type: data.source === 'local' || data.type === 'local' ? 'local' : 'remote',
    url: data.url || '',
    content: data.content || '',
    filters: toApiFilters(data.process),
    enabled: data.enabled !== false,
    meta,
  };
};

const fromApiCollection = (collection: JsonMap): Collection => {
  const meta = collection.meta && typeof collection.meta === 'object' ? collection.meta : {};
  return {
    ...meta,
    name: collection.id,
    displayName: collection.name,
    'display-name': collection.name,
    subscriptions: Array.isArray(collection.sourceIds) ? collection.sourceIds : [],
    process: Array.isArray(meta.actions) ? cloneJson(meta.actions) : fromApiFilters(collection.filters),
    templateId: collection.templateId || 'acl4ssr-mihomo',
    ignoreFailedRemoteSub: collection.ignoreFailed === false ? 'disabled' : 'quiet',
    enabled: collection.enabled !== false,
    tag: normalizeTags(meta.tag),
  } as Collection;
};

const toApiCollection = (data: JsonMap) => {
  const meta = {
    ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
    actions: toActionMeta(data.process),
    ...compactMeta(data, [
      'id',
      'name',
      'displayName',
      'display-name',
      'sourceIds',
      'subscriptions',
      'process',
      'filters',
      'templateId',
      'ignoreFailed',
      'ignoreFailedRemoteSub',
      'enabled',
      'proxy',
      'mergeSources',
      'firstSubFlow',
      'meta',
    ]),
  };

  return {
    id: data.id || data.name,
    name: data.displayName || data['display-name'] || data.id || data.name,
    sourceIds: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    filters: toApiFilters(data.process),
    templateId: data.templateId || 'acl4ssr-mihomo',
    ignoreFailed: data.ignoreFailed === false || data.ignoreFailedRemoteSub === 'disabled' ? false : true,
    enabled: data.enabled !== false,
    meta,
  };
};

const fromApiTemplate = (template: JsonMap) => ({
  ...template,
  name: template.id,
  displayName: template.name,
});

const adaptResponseData = <T = any>(response: AxiosResponse<MyAxiosRes>, adapter: (data: any) => T) => {
  if (response.data?.status === 'success') {
    response.data.data = adapter(response.data.data);
  }
  return response;
};

const toApiPayload = (type: string, data: Sub | Collection | any) => {
  return toApiListType(type) === 'collections' ? toApiCollection(data) : toApiSource(data);
};

const fromApiPayload = (type: string, data: any) => {
  if (Array.isArray(data)) return data.map(item => fromApiPayload(type, item));
  if (toUiListType(type) === 'collections') return fromApiCollection(data);
  return fromApiSource(data);
};

export function useCloudflareApi() {
  return {
    getSources: (): AxiosPromise<MyAxiosRes> => {
      return request({
        url: '/api/sources',
        method: 'get',
      }).then(response => adaptResponseData(response, data => fromApiPayload('subs', data)));
    },
    getCollections: (): AxiosPromise<MyAxiosRes> => {
      return request({
        url: `/api/collections`,
        method: 'get',
      }).then(response => adaptResponseData(response, data => fromApiPayload('collections', data)));
    },
    getTemplates: (): AxiosPromise<MyAxiosRes> => {
      return request({
        url: '/api/templates',
        method: 'get',
      }).then(response => adaptResponseData(response, data => Array.isArray(data) ? data.map(fromApiTemplate) : data));
    },
    createTemplate: (data: any): AxiosPromise<MyAxiosRes> => {
      return request({
        url: '/api/templates',
        method: 'post',
        data,
      }).then(response => adaptResponseData(response, fromApiTemplate));
    },
    updateTemplate: (name: string, data: any): AxiosPromise<MyAxiosRes> => {
      return request({
        url: `/api/templates/${encodeURIComponent(name)}`,
        method: 'patch',
        data,
      }).then(response => adaptResponseData(response, fromApiTemplate));
    },
    deleteTemplate: (name: string): AxiosPromise<MyAxiosRes> => {
      return request({
        url: `/api/templates/${encodeURIComponent(name)}`,
        method: 'delete',
      });
    },
    getOne: (type: string, name: string): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/${apiListType}/${encodeURIComponent(name)}`,
        method: 'get',
      }).then(response => adaptResponseData(response, data => fromApiPayload(apiListType, data)));
    },
    downloadSource: (name: string, params?: any): AxiosPromise<MyAxiosRes> => {
      return request({
        url: `/download/source/${encodeURIComponent(name)}`,
        params,
        method: 'get',
      });
    },
    getFlow: (name: string, signal?: AbortSignal): AxiosPromise<MyAxiosRes> => {
      return request({
        url: `/api/source/flow/${encodeURIComponent(name)}`,
        method: 'get',
        signal,
      });
    },
    getDownloadLink: (
      type: 'sub' | 'collection',
      name: string,
      target?: string,
    ): AxiosPromise<MyAxiosRes> => {
      const apiType = type === 'collection' ? 'collection' : 'source';
      return request({
        url: `/api/link/${apiType}/${encodeURIComponent(name)}`,
        method: 'get',
        params: target ? { target } : undefined,
      });
    },
    createItem: (
      type: string,
      data: Sub | Collection,
    ): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/${apiListType}`,
        method: 'post',
        data: toApiPayload(type, data),
      }).then(response => adaptResponseData(response, result => fromApiPayload(apiListType, result)));
    },
    editItem: (
      type: string,
      name: string,
      data: Sub | Collection
    ): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/${apiListType}/${encodeURIComponent(name)}`,
        method: 'patch',
        data: toApiPayload(type, data),
      }).then(response => adaptResponseData(response, result => fromApiPayload(apiListType, result)));
    },
    deleteItem: (
      type: string,
      name: string,
      mode?: DeleteMode,
    ): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/${apiListType}/${encodeURIComponent(name)}`,
        method: 'delete',
        params: mode ? { mode } : undefined,
      });
    },
    previewItem: (
      type: string,
      data: Sub | Collection | any
    ): AxiosPromise<MyAxiosRes> => {
      const apiType = toApiListType(type) === 'collections' ? 'collection' : 'source';
      return request({
        url: `/api/preview/${apiType}`,
        method: 'post',
        data: toApiPayload(type, data),
      });
    },
    sortItems: (
      type: string,
      data: Sub | Collection
    ): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/${apiListType}`,
        method: 'put',
        data,
      }).then(response => adaptResponseData(response, result => fromApiPayload(apiListType, result)));
    },
    reorderItems: (
      type: string,
      data: Sub | Collection
    ): AxiosPromise<MyAxiosRes> => {
      const apiListType = toApiListType(type);
      return request({
        url: `/api/sort/${apiListType}`,
        method: 'post',
        data,
      }).then(response => adaptResponseData(response, result => fromApiPayload(apiListType, result)));
    },
  };
}
