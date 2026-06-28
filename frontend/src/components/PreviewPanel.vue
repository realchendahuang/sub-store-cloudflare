<template>
  <div>
    <div class="desc" @click="tips">
      <span>{{ desc }}</span>
      <nut-icon name="tips"></nut-icon>
    </div>
    <div class="preview-options">
      <div class="preview-option-item">
        <input type="checkbox" id="includeUnsupportedProxy" name="includeUnsupportedProxy" value="includeUnsupportedProxy" v-model="includeUnsupportedProxy">
        <label for="includeUnsupportedProxy">{{ includeUnsupportedProxyLabel }}</label>
      </div>
      <div class="preview-option-item">
        <input
          type="checkbox"
          id="prettyYaml"
          name="prettyYaml"
          value="prettyYaml"
          v-model="prettyYaml"
        >
        <label for="prettyYaml">{{ prettyYamlLabel }}</label>
      </div>
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
          <button class="copy-sub-link" @click.stop="targetOpen(platform.path)">
            <svg-icon
              name="view"
              class="action-icon"
              color="var(--comment-text-color)"
            />
          </button>
          <button class="copy-sub-link" @click.stop="targetCopy(platform.path)">
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
  import { onMounted, ref, watch } from 'vue';
  import json from '@/assets/icons/json.svg';
  import uri from '@/assets/icons/uri.svg';
  import v2ray from '@/assets/icons/v2ray.png';
  import singbox from '@/assets/icons/sing-box.png';
  import clashmeta from '@/assets/icons/clashmeta.png';
  import logoIcon from '@/assets/icons/logo.png';
  import { useClipboard } from '@vueuse/core';
  import useV3Clipboard from 'vue-clipboard3';
  import { useAppNotifyStore } from '@/store/appNotify';
  import SvgIcon from '@/components/SvgIcon.vue';
  import { useHostAPI } from '@/hooks/useHostAPI';
  import { storeToRefs } from "pinia";
  import { useSettingsStore } from '@/store/settings';
  import { useCloudflareApi } from '@/api/app';

  const settingsStore = useSettingsStore();
  const { changeAppearanceSetting } = settingsStore;
  const { appearanceSetting } = storeToRefs(settingsStore);

  const includeUnsupportedProxy = ref(false);
  const prettyYaml = ref(false);
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
    tipsTitle,
    tipsContent,
    desc,
    tipsCancelText,
    tipsOkText,
    includeUnsupportedProxyLabel,
    prettyYamlLabel,
  } = defineProps<{
    name: string;
    displayName?: string;
    type: 'sub' | 'collection';
    general: string;
    notify: string;
    desc: string;
    includeUnsupportedProxyLabel: string;
    prettyYamlLabel: string;
    url?: string;
    tipsTitle?: string;
    tipsContent?: string;
    tipsCancelText?: string;
    tipsOkText?: string;
  }>();

  const { currentUrl: host } = useHostAPI();
  const cloudflareApi = useCloudflareApi();

  const PREVIEW_INCLUDE_UNSUPPORTED_PROXY_KEY = "preview.includeUnsupportedProxy";
  const PREVIEW_PRETTY_YAML_KEY = "preview.prettyYaml";

  const getLocalStorageBoolean = (key: string): boolean => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };

  const setLocalStorageBoolean = (key: string, value: boolean) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // ignore localStorage write failures in restricted environments
    }
  };

  onMounted(() => {
    includeUnsupportedProxy.value = getLocalStorageBoolean(PREVIEW_INCLUDE_UNSUPPORTED_PROXY_KEY);
    prettyYaml.value = getLocalStorageBoolean(PREVIEW_PRETTY_YAML_KEY);
  });

  watch(includeUnsupportedProxy, (value) => {
    setLocalStorageBoolean(PREVIEW_INCLUDE_UNSUPPORTED_PROXY_KEY, value);
  });
  watch(prettyYaml, (value) => {
    setLocalStorageBoolean(PREVIEW_PRETTY_YAML_KEY, value);
  });
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
    if (includeUnsupportedProxy.value) {
      query.includeUnsupportedProxy = true;
    }
    if (prettyYaml.value) {
      query.prettyYaml = true;
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
    });
  }
  const getRealUrl = async (path: PlatformPath) => {
    if (url) return getUrl(path);
    const res = await cloudflareApi.getDownloadLink(type, name, path || undefined);
    const realUrl = res?.data?.status === 'success' && res.data.data?.url
      ? res.data.data.url
      : getUrl(path);

    const query = {} as Record<string, string | boolean>;
    if (includeUnsupportedProxy.value) {
      query.includeUnsupportedProxy = true;
    }
    if (prettyYaml.value) {
      query.prettyYaml = true;
    }
    return buildUrlWithQuery(realUrl, query);
  };
  const targetOpen = async (path: PlatformPath) => {
    const realUrl = await getRealUrl(path);
    const nextUrl = appearanceSetting.value.displayPreviewInWebPage
      ? buildUrlWithQuery('/preview', {
          url: realUrl,
          name: displayName || name,
          api: host.value,
        })
      : realUrl;
    window.open(nextUrl, '_blank');
  };
  const targetCopy = async (path: PlatformPath) => {
    const url = await getRealUrl(path);
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
    {
      name: 'Mihomo',
      path: 'mihomo',
      icon: clashmeta,
    },
    {
      name: 'sing-box',
      path: 'sing-box',
      icon: singbox,
    },
    {
      name: 'V2Ray',
      path: 'V2Ray',
      icon: v2ray,
    },
    {
      name: 'URI',
      path: 'URI',
      icon: uri,
    },
    {
      name: 'JSON',
      path: 'JSON',
      icon: json,
    },
  ];
  const tips = () => {
    window.open('https://github.com/realchendahuang/sub-store-cloudflare#%E9%85%8D%E7%BD%AE%E6%A8%A1%E5%9E%8B');
  };
</script>

<style lang="scss" scoped>
  .preview-options {
    width: max-content;
    max-width: 100%;
    margin: 6px auto 4px;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    column-gap: 18px;
    row-gap: 8px;
    flex-wrap: wrap;

    .preview-option-item {
      display: flex;
      align-items: center;
      font-size: 12px;
      gap: 4px;
      white-space: nowrap;
    }

    input {
      cursor: pointer;
      padding: 0;
      margin: 0;
    }

    label {
      cursor: pointer;
    }
  }
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
