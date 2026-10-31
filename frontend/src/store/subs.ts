import { useCloudflareApi } from '@/api/app';
import i18n from '@/locales';
import { useAppNotifyStore } from '@/store/appNotify';
import { getFlowsUrlList } from '@/utils/getFlowsUrlList';
import { isAbortError, runFrontendRequestTask } from '@/utils/requestConcurrency';
import { defineStore } from 'pinia';

const { t } = i18n.global;
const cloudflareApi = useCloudflareApi();

const fetchFlowsAbortControllers = new Set<AbortController>();
const fetchFlowAbortControllers = new Map<string, AbortController>();
const latestFlowRequestVersions = new Map<string, number>();
// 流量信息上次成功获取时间（按 flow key），用于 60 秒内不重复请求
const flowFetchedAt = new Map<string, number>();
const FLOW_REFETCH_INTERVAL = 60 * 1000;
let flowRequestSequence = 0;

const canFetchFlowsForCurrentPage = () => window.location.pathname === '/subs';

const createFlowRequestState = (flowKey: string, parentSignal: AbortSignal) => {
  fetchFlowAbortControllers.get(flowKey)?.abort();

  const version = ++flowRequestSequence;
  const abortController = new AbortController();
  const abortCurrentFlow = () => abortController.abort();

  fetchFlowAbortControllers.set(flowKey, abortController);
  latestFlowRequestVersions.set(flowKey, version);

  if (parentSignal.aborted) {
    abortController.abort();
  } else {
    parentSignal.addEventListener('abort', abortCurrentFlow, { once: true });
  }

  return {
    signal: abortController.signal,
    version,
    clear: () => {
      parentSignal.removeEventListener('abort', abortCurrentFlow);
      if (fetchFlowAbortControllers.get(flowKey) === abortController) {
        fetchFlowAbortControllers.delete(flowKey);
      }
      clearFlowRequestVersion(flowKey, version);
    },
  };
};

const isLatestFlowRequest = (flowKey: string, version: number, signal?: AbortSignal) => {
  return !signal?.aborted && latestFlowRequestVersions.get(flowKey) === version;
};

const clearFlowRequestVersion = (flowKey: string, version: number) => {
  if (latestFlowRequestVersions.get(flowKey) === version) {
    latestFlowRequestVersions.delete(flowKey);
  }
};

type FetchFlowsOptions = {
  cancelPrevious?: boolean;
  missingOnly?: boolean;
  /** 用户显式刷新：忽略 60 秒内已获取过的缓存 */
  force?: boolean;
  priority?: number;
};
export const useSubsStore = defineStore('subsStore', {
  state: (): SubsStoreState => {
    return {
      subs: [],
      collections: [],
      flows: {},
    };
  },
  getters: {
    hasSubs: ({ subs }): boolean => subs.length > 0,
    hasCollections: ({ collections }): boolean => collections.length > 0,
    getOneSub:
      ({ subs }): GetOne<Sub> =>
      (name: string) =>
        subs.find(sub => sub.name === name),
    getOneCollection:
      ({ collections }): GetOne<Collection> =>
      (name: string): Collection =>
        collections.find(collection => collection.name === name),
  },
  actions: {
    async fetchSubsData() {
      await Promise.allSettled([
        runFrontendRequestTask(async () => {
          const res = await cloudflareApi.getSources();
          if ('data' in res.data) {
            this.subs = res.data.data.map(i => {
              if (!Array.isArray(i.tag)) {
                i.tag = []
              }
              return i
            });
          }
        }, 'subs.getSubs'),
        runFrontendRequestTask(async () => {
          const res = await cloudflareApi.getCollections();
          if ('data' in res.data) {
            this.collections = res.data.data.map(i => {
              if (!Array.isArray(i.tag)) {
                i.tag = []
              }
              return i
            });
          }
        }, 'subs.getCollections'),
      ]);
    },
    setOneData(type: string, name: string, data: any) {
      const index = this[type].findIndex(item => item.name === name);
      if (index !== -1) {
        this[type][index] = data;
      }
    },
    async updateOneData(type: string, name: string) {
      try {
        let res;
        if (type === 'subs') {
          res = await cloudflareApi.getOne('sub', name);
        } else if (type === 'collections') {
          res = await cloudflareApi.getOne('collection', name);
        }
        if (res?.data?.status === 'success') {
          const index = this[type].findIndex(item => item.name === name);
          this[type][index] = res.data.data;
        } 
      } catch (error) {
        console.error('updateOneData error', error);
      }
    },
    cancelFetchFlows() {
      if (
        fetchFlowsAbortControllers.size === 0
        && fetchFlowAbortControllers.size === 0
        && latestFlowRequestVersions.size === 0
      ) return;

      fetchFlowsAbortControllers.forEach(controller => controller.abort());
      fetchFlowsAbortControllers.clear();
      fetchFlowAbortControllers.forEach(controller => controller.abort());
      fetchFlowAbortControllers.clear();
      latestFlowRequestVersions.clear();
    },
    resetAll() {
      this.cancelFetchFlows();
      flowFetchedAt.clear();
      this.$reset();
    },
    async fetchFlows(sub?: Sub[], options: FetchFlowsOptions = {}) {
      type FlowUrlItem = [string, string, boolean, boolean, boolean];
      if (!canFetchFlowsForCurrentPage()) {
        this.cancelFetchFlows();
        return;
      }

      const isTargetedFetch = Boolean(sub);
      const {
        cancelPrevious = !isTargetedFetch,
        missingOnly = false,
        force = false,
        priority = isTargetedFetch ? 100 : 0,
      } = options;

      if (cancelPrevious) {
        this.cancelFetchFlows();
      }

      const abortController = new AbortController();
      fetchFlowsAbortControllers.add(abortController);
      const { signal } = abortController;

      const asyncGetFlow = async (
        [url, name, noFlow, hideExpire, showRemaining],
        index,
        requestVersion: number,
        requestSignal: AbortSignal,
        clearRequest: () => void,
      ) => {
        try {
          if (!isLatestFlowRequest(url, requestVersion, requestSignal)) {
            return;
          }

          if (noFlow) {
            this.flows[url] = { status:'noFlow' };
          } else {
            const res = await cloudflareApi.getFlow(name, requestSignal);
            if (!isLatestFlowRequest(url, requestVersion, requestSignal)) {
              return;
            }

            const data = res?.data;
            if (data) {
              this.flows[url] = {...data, hideExpire, showRemaining };
              flowFetchedAt.set(url, Date.now());
            }
          }
        } catch (e) {
          if (isAbortError(e) || requestSignal.aborted) {
            throw e;
          }
        } finally {
          clearRequest();
        }
      };

      const now = Date.now();
      const flowsUrlList = (getFlowsUrlList(sub || this.subs) as FlowUrlItem[])
        .filter(([url]) => !missingOnly || !(url in this.flows))
        .filter(([url, , noFlow]) => {
          if (force || noFlow || !(url in this.flows)) return true;
          const fetchedAt = flowFetchedAt.get(url);
          return fetchedAt === undefined || now - fetchedAt >= FLOW_REFETCH_INTERVAL;
        });

      const flowTasks = [] as Array<{ label: string; signal: AbortSignal; task: () => Promise<void> }>;

      flowsUrlList.forEach((item, index) => {
        const [url, , noFlow] = item;
        const requestState = createFlowRequestState(url, signal);
        if (noFlow) {
          if (isLatestFlowRequest(url, requestState.version, requestState.signal)) {
            this.flows[url] = { status:'noFlow' };
          }
          requestState.clear();
          return;
        }
        flowTasks.push({
          label: `subs.getFlow:${item[1]}`,
          signal: requestState.signal,
          task: () => asyncGetFlow(
            item,
            index,
            requestState.version,
            requestState.signal,
            requestState.clear,
          ),
        });
      });

      try {
        await Promise.all(flowTasks.map(({ label, signal: flowSignal, task }) => (
          runFrontendRequestTask(task, label, { priority, signal: flowSignal })
            .catch((error) => {
              if (!isAbortError(error) && !flowSignal.aborted) {
                throw error;
              }
            })
        )))
      } catch (error) {
        if (!isAbortError(error) && !signal.aborted) {
          throw error;
        }
      } finally {
        fetchFlowsAbortControllers.delete(abortController);
      }
    },
    async deleteItem(
      type: SubsType,
      name: string,
      mode?: DeleteMode,
      isShowNotify: boolean = true,
    ) {
      try {
        const { showNotify } = useAppNotifyStore();

        const { data } = await cloudflareApi.deleteItem(type, name, mode);
        if (data.status === 'success') {
          await this.fetchSubsData();
          isShowNotify && showNotify({
            type: 'danger',
            title: t('subPage.deleteItem.succeedNotify'),
          });
          return true;
        }
      } catch (error) {
        console.error('deleteItem error', error);
      }

      return false;
    },
  },
});
