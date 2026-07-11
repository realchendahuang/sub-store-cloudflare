export type FilterRule = {
  type:
    | "include"
    | "exclude"
    | "rename"
    | "dedupe"
    | "sort"
    | "delete-field"
    | "regex-sort"
    | "flag"
    | "quick"
    | "resolve"
    | string;
  field?: string;
  fields?: string[];
  pattern?: string;
  patterns?: string[];
  expressions?: string[];
  replacement?: string;
  direction?: "asc" | "desc" | "random" | "original";
  action?: "delete" | "rename";
  link?: string;
  position?: "front" | "back";
  template?: string;
  provider?: string;
  recordType?: "A" | "AAAA" | string;
  filter?: "disabled" | "removeFailed" | "IPOnly" | "IPv4Only" | "IPv6Only" | string;
  url?: string;
  edns?: string;
  concurrency?: number | string;
  scriptId?: string;
  scriptKind?: "filter" | "operator";
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProxyNode = Record<string, unknown> & {
  name: string;
  type: string;
  server?: string;
  port?: number;
};

export type SubscriptionSource = {
  id: string;
  name: string;
  type: "remote" | "local";
  url: string;
  content: string;
  filters?: FilterRule[];
  enabled?: boolean;
  meta?: Record<string, unknown>;
};

export type SubscriptionCollection = {
  id: string;
  name: string;
  sourceIds?: string[];
  filters?: FilterRule[];
  templateId?: string;
  ignoreFailed?: boolean;
  enabled?: boolean;
  meta?: Record<string, unknown>;
};

export type RoutingTemplate = {
  id?: string;
  name?: string;
  target?: SubscriptionTarget;
  config: RoutingTemplateConfig;
};

export type RoutingTemplateConfig = {
  mixedPort?: number;
  "mixed-port"?: number;
  allowLan?: boolean;
  "allow-lan"?: boolean;
  mode?: string;
  logLevel?: string;
  "log-level"?: string;
  dns?: Record<string, unknown>;
  sniffer?: Record<string, unknown>;
  proxyGroups?: TemplateProxyGroup[];
  "proxy-groups"?: TemplateProxyGroup[];
  ruleProviders?: Record<string, unknown>;
  "rule-providers"?: Record<string, unknown>;
  rules?: string[];
  [key: string]: unknown;
};

export type TemplateProxyGroup = {
  name: string;
  type: "select" | "url-test" | "fallback" | "load-balance" | string;
  proxies?: string[];
  filter?: string;
  url?: string;
  interval?: number;
  tolerance?: number;
  [key: string]: unknown;
};

export type SubscriptionTarget =
  | "mihomo"
  | "stash"
  | "surge"
  | "surge-mac"
  | "surfboard"
  | "loon"
  | "egern"
  | "shadowrocket"
  | "qx"
  | "sing-box"
  | "v2ray"
  | "uri"
  | "json";

export type SubscriptionResponseMetadata = {
  subscriptionUserinfo?: string;
  profileWebPageUrl?: string;
  profileUpdateInterval?: string;
  contentDisposition?: string;
  etag?: string;
  lastModified?: string;
  cacheStatus?: "hit" | "miss" | "refresh" | "stale" | "disabled";
};

export type DownloadGrantRecord = {
  id: string;
  resourceType: "source" | "collection";
  resourceId: string;
  target?: SubscriptionTarget;
  expiresAt?: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type RecycleBinRecord = {
  id: string;
  resourceType: "source" | "collection" | "template" | "share";
  resourceId: string;
  snapshot: Record<string, unknown>;
  deletedAt: number;
};

export type SourceRecord = {
  id: string;
  name: string;
  type: "remote" | "local";
  url: string;
  content: string;
  enabled: boolean;
  filters: FilterRule[];
  meta: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type CollectionRecord = {
  id: string;
  name: string;
  sourceIds: string[];
  filters: FilterRule[];
  templateId: string;
  ignoreFailed: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  meta: Record<string, unknown>;
};

export type TemplateRecord = {
  id: string;
  name: string;
  target: SubscriptionTarget;
  config: RoutingTemplateConfig;
  createdAt: number;
  updatedAt: number;
};

export type AppSettings = Record<string, unknown>;

export type AppConfig = {
  sources: SourceRecord[];
  collections: CollectionRecord[];
  templates: TemplateRecord[];
  settings?: AppSettings;
};
