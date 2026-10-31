import i18n from "@/locales";
import { useAppNotifyStore } from "@/store/appNotify";
import { useGlobalStore } from "@/store/global";
import { useSettingsStore } from "@/store/settings";
import { useSubsStore } from "@/store/subs";
import { getApiRequestTimeout } from "@/utils/requestTimeout";

// 后端连通性检查（/api/env）的最长等待时间，超过则由 axios 取消请求
const ENV_REQUEST_TIMEOUT = 10000;

type InitStoresOptions = {
  /** 用户显式刷新：忽略 60 秒内已获取过的流量缓存 */
  forceFlows?: boolean;
};

export const initStores = async (
  needNotify: boolean,
  needFetchFlow: boolean,
  options: InitStoresOptions = {},
) => {
  const { showNotify } = useAppNotifyStore();
  const globalStore = useGlobalStore();
  const subsStore = useSubsStore();
  const settingsStore = useSettingsStore();

  const { t } = i18n.global;
  let isSucceed = true;
  globalStore.setLoading(true);
  globalStore.setFetchResult(true);

  // 更新所有数据
  try {
    // 先获取后端环境信息，这是判断后端连接是否成功的关键
    try {
      await globalStore.setEnv({
        timeout: Math.min(ENV_REQUEST_TIMEOUT, getApiRequestTimeout()),
        strict: true,
      });
    } catch (envError) {
      console.error('Error getting backend environment:', envError);
      globalStore.setFetchResult(false);
      isSucceed = false;
      throw envError; // 重新抛出异常，中断后续操作
    }

    // 成功获取环境信息后，并行获取订阅数据与设置
    await Promise.all([
      subsStore.fetchSubsData(),
      settingsStore.fetchSettings(),
    ]);
  } catch (e) {
    console.error('Error initializing stores:', e);
    globalStore.setFetchResult(false);
    subsStore.subs = [];
    subsStore.collections = [];
    isSucceed = false;
  }

  // 发送通知
  if (isSucceed && needNotify) {
    showNotify({ title: t("globalNotify.refresh.succeed"), type: "primary" });
  }

  globalStore.setLoading(false);
  // 更新流量
  if (needFetchFlow) await subsStore.fetchFlows(undefined, { force: options.forceFlows === true });
};
