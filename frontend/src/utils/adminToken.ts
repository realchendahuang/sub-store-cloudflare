import { ref } from 'vue';

export const ADMIN_TOKEN_STORAGE_KEY = 'substore_admin_token';

const readStoredAdminToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
};

// 响应式镜像，便于登出 / 401 清除后让 UI（如 Sub.vue 的 token 输入框）同步
export const adminTokenState = ref(readStoredAdminToken());

/**
 * 从 URL 读取管理 token 并写入本地存储，然后把它从地址栏移除。
 * 优先读取 `#token=...`（hash 不会发送到服务器），兼容旧的 `?token=...`。
 * 路由使用 history 模式，hash 不参与路由，只移除 token 参数并保留其它 hash 内容。
 */
export const syncAdminTokenFromUrl = () => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  let token = '';
  let changed = false;

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  if (hashParams.has('token')) {
    token = (hashParams.get('token') || '').trim();
    hashParams.delete('token');
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : '';
    changed = true;
  }

  if (url.searchParams.has('token')) {
    // hash 中的 token 优先
    if (!token) token = (url.searchParams.get('token') || '').trim();
    url.searchParams.delete('token');
    changed = true;
  }

  if (token) setStoredAdminToken(token);
  if (changed) {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
};

export const getStoredAdminToken = () => {
  return readStoredAdminToken();
};

export const setStoredAdminToken = (token: string) => {
  if (typeof window === 'undefined') return;

  const normalized = token.trim();
  if (normalized) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
  adminTokenState.value = normalized;
};

export const clearStoredAdminToken = () => setStoredAdminToken('');
