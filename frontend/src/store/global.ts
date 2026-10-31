import { defineStore } from 'pinia';
import { useEnvApi } from '@/api/env';

const envApi = useEnvApi();

export const useGlobalStore = defineStore('globalStore', {
  state: (): GlobalStoreState => {
    return {
      subProgressStyle: localStorage.getItem('subProgressStyle') || 'hidden',
      isLoading: true,
      isFlowFetching: true,
      fetchResult: false,
      isDefaultIcon: localStorage.getItem('isDefaultIcon') === '1',
      isDarkMode: false,
      env: {},
      isSimpleMode: localStorage.getItem('isSimpleMode') === null
        ? true
        : localStorage.getItem('isSimpleMode') === '1',
      isLeftRight: localStorage.getItem('isLr') === '1',
      isIconColor: localStorage.getItem('iconColor') === '1',
      isEditorCommon: localStorage.getItem('iseditorCommon') !== '1',
      isSimpleReicon: localStorage.getItem('isSimpleReicon') === '1',
      showFloatingRefreshButton: localStorage.getItem('showFloatingRefreshButton') === '1',
      savedPositions: {},
    };
  },
  getters: {},
  actions: {
    setSubProgressStyle(style: string) {
      if (style && style !== 'hidden') {
        localStorage.setItem('subProgressStyle', style);
      } else {
        localStorage.removeItem('subProgressStyle');
      }
      this.subProgressStyle = style;
    },
    setLoading(isLoading: boolean) {
      this.isLoading = isLoading;
    },
    setFlowFetching(isFlowFetching: boolean) {
      this.isFlowFetching = isFlowFetching;
    },
    setFetchResult(fetchResult: boolean) {
      this.fetchResult = fetchResult;
    },
    setDarkMode(isDarkMode: boolean) {
      this.isDarkMode = isDarkMode;
    },
    setSimpleMode(isSimpleMode: boolean) {
      if (isSimpleMode) {
        localStorage.setItem('isSimpleMode', '1');
      } else {
        localStorage.setItem('isSimpleMode', '0');
      }
      this.isSimpleMode = isSimpleMode;
    },
    setLeftRight(isLr: boolean) {
      if (isLr) {
        localStorage.setItem('isLr', '1');
      } else {
        localStorage.removeItem('isLr');
      }
      this.isLeftRight = isLr;
    },
    setIconColor(iconColor: boolean) {
      if (iconColor) {
        localStorage.setItem('iconColor', '1');
      } else {
        localStorage.removeItem('iconColor');
      }
      this.isIconColor = iconColor;
    },
    setIsDefaultIcon(isDefaultIcon: boolean) {
      if (isDefaultIcon) {
        localStorage.setItem('isDefaultIcon', '1');
      } else {
        localStorage.removeItem('isDefaultIcon');
      }
      this.isDefaultIcon = isDefaultIcon;
    },
    setEditorCommon(isEditorCommon: boolean) {
      if (!isEditorCommon) {
        localStorage.setItem('iseditorCommon', '1');
      } else {
        localStorage.removeItem('iseditorCommon');
      }
      this.isEditorCommon = isEditorCommon;
    },
    setSimpleReicon(isSimpleReicon: boolean) {
      if (isSimpleReicon) {
        localStorage.setItem('isSimpleReicon', '1');
      } else {
        localStorage.removeItem('isSimpleReicon');
      }
      this.isSimpleReicon = isSimpleReicon;
    },
    setShowFloatingRefreshButton(showFloatingRefreshButton: boolean) {
      if (showFloatingRefreshButton) {
        localStorage.setItem('showFloatingRefreshButton', '1');
      } else {
        localStorage.removeItem('showFloatingRefreshButton');
      }
      this.showFloatingRefreshButton = showFloatingRefreshButton;
    },
    async setEnv(options?: { timeout?: number; strict?: boolean }) {
      const res = await envApi.getEnv({ timeout: options?.timeout });
      const nextEnv = res?.data?.status === 'success' ? res.data.data : null;

      if (!nextEnv?.backend) {
        if (options?.strict) {
          throw new Error('ENV_LOAD_FAILED');
        }
        return null;
      }

      this.env = nextEnv;

      return nextEnv;
    },
    setSavedPositions(key: string, value: any) {
      this.savedPositions[key] = value;
    },
  },
});
