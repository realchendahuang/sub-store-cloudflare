// 没有保存的选择、浏览器语言也不是中文时使用的语言
export const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = [
  {
    key: "zh",
    labelKey: "navBar.langSwitcher.zh",
    dayjsLocale: "zh",
    datePickerLocale: "zh-CN",
  },
  {
    key: "en",
    labelKey: "navBar.langSwitcher.en",
    dayjsLocale: "en",
    datePickerLocale: "en-US",
  },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["key"];

const SUPPORTED_LOCALE_KEYS = SUPPORTED_LOCALES.map((locale) => locale.key);

const matchLocale = (value?: string | null): SupportedLocale | undefined => {
  const localePrefix = String(value || "")
    .toLowerCase()
    .split(/[-_]/)[0];

  return SUPPORTED_LOCALE_KEYS.includes(localePrefix as SupportedLocale)
    ? (localePrefix as SupportedLocale)
    : undefined;
};

export const normalizeLocale = (value?: string | null): SupportedLocale => {
  return matchLocale(value) || DEFAULT_LOCALE;
};

// 优先级：用户保存的选择 > 浏览器语言为中文（zh-*）时用中文 > 英文
export const getInitialLocale = (): SupportedLocale => {
  const saved = matchLocale(localStorage.getItem("locale"));
  if (saved) return saved;
  return String(navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
};

export const getLocaleConfig = (locale?: string | null) => {
  const normalizedLocale = normalizeLocale(locale);
  return (
    SUPPORTED_LOCALES.find((item) => item.key === normalizedLocale) ||
    SUPPORTED_LOCALES[0]
  );
};
