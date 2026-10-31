import { useCloudflareApi } from '@/api/app';

export class DownloadLinkError extends Error {
  constructor() {
    super('DOWNLOAD_LINK_UNAVAILABLE');
    this.name = 'DownloadLinkError';
  }
}

// 本次会话内按「条目 + 目标格式」缓存 /api/link 的结果
const downloadLinkCache = new Map<string, string>();

const cacheKey = (type: 'sub' | 'collection', name: string, target?: string) => {
  return JSON.stringify([type, name, target || '']);
};

export const clearDownloadLinkCache = () => downloadLinkCache.clear();

/**
 * 获取带下载 token 的订阅链接。失败时抛出异常，不会回退到不带 token 的链接。
 * HTTP 错误会抛出 axios 错误（拦截器已提示），后端未返回链接时抛出 DownloadLinkError。
 */
export const getDownloadLink = async (
  type: 'sub' | 'collection',
  name: string,
  target?: string,
): Promise<string> => {
  const key = cacheKey(type, name, target);
  const cached = downloadLinkCache.get(key);
  if (cached) return cached;

  const res = await useCloudflareApi().getDownloadLink(type, name, target);
  const url = res?.data?.status === 'success' ? res.data.data?.url : undefined;
  if (typeof url !== 'string' || !url) throw new DownloadLinkError();

  downloadLinkCache.set(key, url);
  return url;
};
