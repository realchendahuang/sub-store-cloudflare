import { useGlobalStore } from '@/store/global';
import { useSettingsStore } from '@/store/settings';
import { useSubsStore } from '@/store/subs';
import { clearStoredAdminToken } from '@/utils/adminToken';
import { clearDownloadLinkCache } from '@/utils/downloadLink';
import type { Router } from 'vue-router';

/**
 * 清除管理 token，重置 subs / settings 等 store，并回到 token 输入界面（/subs 的加载失败状态）。
 * 主动登出与 401 响应共用。
 */
export const resetToTokenEntry = async (router: Router) => {
  clearStoredAdminToken();
  clearDownloadLinkCache();

  const subsStore = useSubsStore();
  const settingsStore = useSettingsStore();
  const globalStore = useGlobalStore();

  subsStore.resetAll();
  settingsStore.$reset();
  globalStore.env = {};
  globalStore.setLoading(false);
  globalStore.setFetchResult(false);

  if (router.currentRoute.value.path !== '/subs') {
    await router.replace('/subs');
  }
};
