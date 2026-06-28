export type SubStoreEnv = {
  ASSETS?: Fetcher;
  DB: D1Database;
  SUB_STORE_APP_NAME?: string;
  SUB_STORE_ADMIN_TOKEN?: string;
  SUB_STORE_PUBLIC_DOWNLOAD_HOSTS?: string;
  SUB_STORE_PUBLIC_DOWNLOAD_TOKEN?: string;
  SUB_STORE_BOOTSTRAP_SOURCE_NAME?: string;
  SUB_STORE_BOOTSTRAP_SOURCE_DISPLAY_NAME?: string;
  SUB_STORE_BOOTSTRAP_SOURCE_CONTENT?: string;
};

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
  [key: string]: unknown;
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
