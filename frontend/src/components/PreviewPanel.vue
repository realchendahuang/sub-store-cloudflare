<template>
  <div>
    <div class="desc" @click="tips">
      <span>{{ desc }}</span>
      <nut-icon name="tips"></nut-icon>
    </div>
    <ul class="preview-list">
      <li v-for="platform in platformList" :key="platform.name">
        <div class="infos">
          <div>
            <img :src="platform.icon" class="auto-reverse" />
          </div>
          <p>{{ platform.name }}</p>
        </div>

        <div class="actions">
          <button
            class="copy-sub-link"
            :aria-label="t('subPage.actions.openTarget', { name: platform.name })"
            :title="t('subPage.actions.openTarget', { name: platform.name })"
            @click.stop="targetOpen(platform.path)"
          >
            <svg-icon
              name="view"
              class="action-icon"
              color="var(--comment-text-color)"
            />
          </button>
          <button
            class="copy-sub-link"
            :aria-label="t('subPage.actions.copyTarget', { name: platform.name })"
            :title="t('subPage.actions.copyTarget', { name: platform.name })"
            @click.stop="targetCopy(platform.path)"
          >
            <svg-icon
              name="copy"
              class="action-icon"
              color="var(--comment-text-color)"
            />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
  import logoIcon from '@/assets/icons/logo.png';
  import { useClipboard } from '@vueuse/core';
  import axios from 'axios';
  import useV3Clipboard from 'vue-clipboard3';
  import { useAppNotifyStore } from '@/store/appNotify';
  import SvgIcon from '@/components/SvgIcon.vue';
  import { useHostAPI } from '@/hooks/useHostAPI';
  import { storeToRefs } from "pinia";
  import { useSettingsStore } from '@/store/settings';
  import { getDownloadLink } from '@/utils/downloadLink';
  import { DOWNLOAD_TARGET_OPTIONS } from '@/constants/subscriptionTargets';
  import { useI18n } from 'vue-i18n';

  const settingsStore = useSettingsStore();
  const { appearanceSetting } = storeToRefs(settingsStore);

  const { t } = useI18n();
  const { copy, isSupported } = useClipboard();
  const { toClipboard: copyFallback } = useV3Clipboard();
  const { showNotify } = useAppNotifyStore();
  const {
    name,
    displayName,
    type,
    url,
    general,
    notify,
    desc,
  } = defineProps<{
    name: string;
    displayName?: string;
    type: 'sub' | 'collection';
    general: string;
    notify: string;
    desc: string;
    url?: string;
  }>();

  const { currentUrl: host } = useHostAPI();

  type PlatformPath = string | null;

  const buildUrlWithQuery = (url: string, query: Record<string, string | boolean>): string => {
    if (!url) {
      return '';
    }
    const queryString = Object.entries(query)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
      
    if (!queryString) {
      return url;
    }
    
    const hasQueryParams = url.includes('?');
    return `${url}${hasQueryParams ? '&' : '?'}${queryString}`;
  };

  const getUrl = (path: PlatformPath, preview: boolean = false) => {
    const query = {} as Record<string, string | boolean>;
    if (path !== null) {
      query.target = path;
    }
    let previewUrl
    if (url) {
      previewUrl = buildUrlWithQuery(url, query);
    } else {
      previewUrl = `${host.value}/download/${
        type === "sub" ? "source/" : "collection/"
        }${encodeURIComponent(name)}${Object.keys(query).length > 0 ? `?${Object.entries(query).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}` : ''}`; 
    }
    if (!preview) {
      return previewUrl;
    }

    return buildUrlWithQuery('/preview', {
      url: previewUrl,
      name: displayName || name,
      api: host.value,
      sourceType: type,
      sourceName: name,
    });
  }
  const getRealUrl = async (path: PlatformPath) => {
    if (url) return getUrl(path);
    // 失败时抛出异常，不回退到不带下载 token 的链接
    return getDownloadLink(type, name, path || undefined);
  };
  const notifyLinkFailed = (e: unknown) => {
    // HTTP 错误已由请求拦截器提示，这里只补充后端未返回链接的情况
    if (!axios.isAxiosError(e)) {
      showNotify({ type: 'danger', title: t('subPage.copyNotify.linkFailed') });
    }
  };
  const targetOpen = async (path: PlatformPath) => {
    const pendingWindow = window.open('about:blank', '_blank');
    let realUrl: string;
    try {
      realUrl = await getRealUrl(path);
    } catch (e) {
      pendingWindow?.close();
      notifyLinkFailed(e);
      return;
    }
    const nextUrl = appearanceSetting.value.displayPreviewInWebPage
        ? buildUrlWithQuery('/preview', {
            url: realUrl,
            name: displayName || name,
            api: host.value,
            sourceType: type,
            sourceName: name,
          })
      : realUrl;
    if (pendingWindow) {
      pendingWindow.location.href = nextUrl;
      return;
    }
    window.open(nextUrl, '_blank');
  };
  const targetCopy = async (path: PlatformPath) => {
    let url: string;
    try {
      url = await getRealUrl(path);
    } catch (e) {
      notifyLinkFailed(e);
      return;
    }
    if (isSupported) {
      await copy(url);
    } else {
      await copyFallback(url);
    }
    showNotify({ title: notify });
  };
  const platformList = [
    {
      name: general,
      path: null,
      icon: logoIcon,
    },
    ...DOWNLOAD_TARGET_OPTIONS.map((target) => ({
      name: target.label,
      path: target.value,
      icon: target.icon,
    })),
  ];
  const tips = () => {
    window.open('https://github.com/realchendahuang/sub-store-cloudflare#%E9%85%8D%E7%BD%AE%E6%A8%A1%E5%9E%8B');
  };
</script>

<style lang="scss" scoped>
  .desc {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
  .preview-list {
    flex: 1;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;

    > li {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;

      &:not(:last-child) {
        border-bottom: 1px solid var(--divider-color);
      }

      .infos {
        flex: 1;
        padding: 3px 0;
        display: flex;
        align-items: center;
        gap: 4px;

        div {
          width: 32px;
          aspect-ratio: 1;
        }

        p {
          font-size: 14px;
          color: var(--second-text-color);
        }
      }

      .actions {
        flex-shrink: 0;
        flex-grow: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        font-size: 20px;

        > button {
          background-color: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
        }
      }
    }
  }
</style>
