import { useAppNotifyStore } from '@/store/appNotify';
import axios, { AxiosError } from 'axios';
import i18n from '@/locales';
import { getHostAPIUrl } from '@/hooks/useHostAPI';
import { clearStoredAdminToken, getStoredAdminToken } from '@/utils/adminToken';
import { getApiRequestTimeout } from '@/utils/requestTimeout';

let appNotifyStore = null;

// 401 提示的去重窗口：多个并发请求同时返回 401 时只提示一次
const UNAUTHORIZED_NOTIFY_INTERVAL = 4000;
let lastUnauthorizedNotifyAt = 0;
let unauthorizedHandler: (() => void) | null = null;

/**
 * 注册 401 处理回调（由应用入口注册，避免 api 层与 store/router 循环依赖）。
 * 回调负责重置 store 并回到 token 输入界面。
 */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

const notifyConfig: { type: 'danger'; duration: number } = {
  type: 'danger',
  duration: 2500,
};

const getText = (value: unknown) => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

const stringifyUnknown = (value: unknown) => {
  const text = getText(value);
  if (text)
    return text;

  if (value == null)
    return undefined;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getResponseTitle = (e: AxiosError<ErrorResponse>) => {
  const backendMessage = getText(e.response?.data?.error?.message);
  if (backendMessage)
    return backendMessage;

  const responseText = getText(e.response?.statusText);
  if (e.response?.status && responseText)
    return i18n.global.t("globalNotify.request.failedWithStatus", { status: e.response.status, statusText: responseText });

  if (e.response?.status)
    return i18n.global.t("globalNotify.request.failedStatusOnly", { status: e.response.status });

  return i18n.global.t("globalNotify.request.failed");
};

const getResponseContent = (e: AxiosError<ErrorResponse>) => {
  const error = e.response?.data?.error;
  const statusLine = e.response?.status ? `status: ${e.response.status}` : undefined;
  const backendErrorLines = [
    getText(error?.code) ? `code: ${getText(error?.code)}` : undefined,
    getText(error?.type) ? `type: ${getText(error?.type)}` : undefined,
    getText(error?.details),
  ].filter(Boolean);

  if (backendErrorLines.length > 0)
    return [statusLine, ...backendErrorLines].filter(Boolean).join('\n');

  const responseData = stringifyUnknown(e.response?.data);
  if (responseData)
    return [statusLine, responseData].filter(Boolean).join('\n');

  return [statusLine, getText(e.message)].filter(Boolean).join('\n') || undefined;
};

const isCanceledRequestError = (error: AxiosError<ErrorResponse>) => {
  return error.name === 'AbortError'
    || error.name === 'CanceledError'
    || error.code === 'ERR_CANCELED'
    || error.message === 'canceled'
    || axios.isCancel(error);
};

// 配置新建一个 axios 实例
const service = axios.create({
  baseURL: getHostAPIUrl(),
  timeout: getApiRequestTimeout(),
  headers: { 'Content-Type': 'application/json' },
});

service.interceptors.request.use(config => {
  const token = getStoredAdminToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

service.interceptors.response.use(
  response => response,
  (e: AxiosError<ErrorResponse>) => {
    const requestUrl = e.config?.url || '';

    if (isCanceledRequestError(e))
      return Promise.reject(e);

    // token 无效或已过期：清除本地 token，回到 token 输入状态，并只提示一次
    if (e.response?.status === 401) {
      // 请求发出后用户已经换了新 token：这是过期请求的 401，忽略，避免清掉新 token
      const currentToken = getStoredAdminToken();
      if (currentToken && e.config?.headers?.get?.('Authorization') !== `Bearer ${currentToken}`)
        return Promise.reject(e);

      clearStoredAdminToken();
      const now = Date.now();
      // 没带 token（首次打开）时直接进入 token 输入界面，不弹"未授权"提示
      const sentToken = Boolean(e.config?.headers?.get?.('Authorization'));
      if (sentToken && now - lastUnauthorizedNotifyAt >= UNAUTHORIZED_NOTIFY_INTERVAL) {
        lastUnauthorizedNotifyAt = now;
        if (!appNotifyStore)
          appNotifyStore = useAppNotifyStore();
        appNotifyStore.showNotify({
          title: i18n.global.t("globalNotify.request.unauthorized"),
          ...notifyConfig,
        });
      }
      unauthorizedHandler?.();
      return Promise.reject(e);
    }

    // 流量信息接口的报错,不通知，直接返回
    if (requestUrl.startsWith('/api/source/flow'))
      return Promise.resolve(e.response);

    if (!appNotifyStore)
      appNotifyStore = useAppNotifyStore();

    // 如果是网络错误，则提示网络错误
    if (!e.response || e.response.status === 0) {
      appNotifyStore.showNotify({
        title: i18n.global.t("globalNotify.request.network"),
        content: [
          `code: ${e.response?.status ?? e.code ?? 'NO_RESPONSE'}`,
          `msg: ${getText(e.message) || i18n.global.t("globalNotify.request.noResponse")}`,
        ].join('\n'),
        ...notifyConfig,
      });
      return Promise.reject(e);
    } else {
      appNotifyStore.showNotify({
        title: getResponseTitle(e),
        content: getResponseContent(e),
        ...notifyConfig,
      });
      return Promise.reject(e);
    }
  }
);

// 导出 axios 实例
export default service;
