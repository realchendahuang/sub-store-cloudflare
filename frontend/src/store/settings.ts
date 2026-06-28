import { useSettingsApi } from "@/api/settings";
import i18n from "@/locales";
import { useAppNotifyStore } from "@/store/appNotify";
import { runFrontendRequestTask } from "@/utils/requestConcurrency";
import { Toast } from "@nutui/nutui";
import { defineStore } from "pinia";
// import { useEnvApi } from '@/api/env';
// import { useSubsStore } from '@/store/subs';

const settingsApi = useSettingsApi();
const { t } = i18n.global;
const LIST_PAGE_VIEW_MODE_STORAGE_KEY = "appearanceSetting.listPageViewMode";
const NARROW_MODE_LIST_PAGE_VIEW_MODE_STORAGE_KEY = "appearanceSetting.listPageViewModeInWideScreenNarrowMode";
const WIDE_SCREEN_NARROW_MODE_STORAGE_KEY = "appearanceSetting.useNarrowModeOnWideScreen";

const normalizeSettingInputValue = (value: unknown) => {
  return value === null || value === undefined ? "" : String(value);
};

const getCachedListPageViewMode = (storageKey: string): ListPageViewMode | undefined => {
  const cachedMode = localStorage.getItem(storageKey);
  if (cachedMode === "single-column" || cachedMode === "dual-column") {
    return cachedMode;
  }

  return undefined;
};

const syncCachedListPageViewMode = (storageKey: string, mode?: ListPageViewMode) => {
  if (mode) {
    localStorage.setItem(storageKey, mode);
  } else {
    localStorage.removeItem(storageKey);
  }
};

const getCachedWideScreenNarrowMode = () => {
  return localStorage.getItem(WIDE_SCREEN_NARROW_MODE_STORAGE_KEY) === "1";
};

const isEditorCommonDisplayMode = (value: unknown): value is EditorCommonDisplayMode => {
  return value === "expanded" || value === "collapsed" || value === "hidden";
};

const isEditorSectionFoldMode = (value: unknown): value is EditorSectionFoldMode => {
  return value === "expanded" || value === "collapsed";
};

const isEditorGroupingMode = (value: unknown): value is EditorGroupingMode => {
  return value === "edit-only" || value === "disabled" || value === "always";
};

const normalizeEditorCommonDisplayMode = (
  appearanceSetting?: SettingsPostData["appearanceSetting"],
): EditorCommonDisplayMode => {
  if (isEditorCommonDisplayMode(appearanceSetting?.editorCommonDisplayMode)) {
    return appearanceSetting.editorCommonDisplayMode;
  }

  if (typeof appearanceSetting?.isEditorCommon === "boolean") {
    return appearanceSetting.isEditorCommon ? "expanded" : "hidden";
  }

  return "collapsed";
};

const normalizeManualSubscriptionsDisplayMode = (
  appearanceSetting?: SettingsPostData["appearanceSetting"],
): EditorSectionFoldMode => {
  if (isEditorSectionFoldMode(appearanceSetting?.manualSubscriptionsDisplayMode)) {
    return appearanceSetting.manualSubscriptionsDisplayMode;
  }

  return "collapsed";
};

const normalizeEditorGroupingMode = (
  appearanceSetting?: SettingsPostData["appearanceSetting"],
): EditorGroupingMode => {
  if (isEditorGroupingMode(appearanceSetting?.editorGroupingMode)) {
    return appearanceSetting.editorGroupingMode;
  }

  return "edit-only";
};

export const useSettingsStore = defineStore("settingsStore", {
  state: (): SettingsStoreState => {
    return {
      githubProxy: "",
      githubProxyRegex: "",
      defaultUserAgent: "",
      defaultFlowUserAgent: "",
      defaultTimeout: "",
      backendRequestConcurrency: "",
      backendRequestConcurrencyWaitTime: "",
      syncTime: 0,
      theme: {
        auto: true,
        name: "light",
        dark: "dark",
        light: "light",
      },
      appearanceSetting: {
        isSimpleMode: true,
        isLeftRight: false,
        isDefaultIcon: false,
        isIconColor: false,
        isShowIcon: true,
        isSimpleShowRemark: false,
        isEditorCommon: true,
        editorCommonDisplayMode: "collapsed",
        manualSubscriptionsDisplayMode: "collapsed",
        editorGroupingMode: "edit-only",
        isSimpleReicon: false,
        isSubItemMenuFold: true,
        showFloatingRefreshButton: false,
        showFloatingAddButton: false,
        createItemPosition: "bottom",
        displayPreviewInWebPage: true,
        subProgressStyle: "hidden",
        listPageViewMode: getCachedListPageViewMode(LIST_PAGE_VIEW_MODE_STORAGE_KEY),
        listPageViewModeInWideScreenNarrowMode: getCachedListPageViewMode(NARROW_MODE_LIST_PAGE_VIEW_MODE_STORAGE_KEY),
        useNarrowModeOnWideScreen: getCachedWideScreenNarrowMode(),
      },
      avatarUrl: "",
      hasFetchedSettings: false,
    };
  },
  getters: {},
  actions: {
    applyAppearanceSetting(appearanceSetting?: SettingsPostData["appearanceSetting"]) {
      const cachedNarrowModeListPageViewMode = getCachedListPageViewMode(
        NARROW_MODE_LIST_PAGE_VIEW_MODE_STORAGE_KEY,
      );
      const editorCommonDisplayMode = normalizeEditorCommonDisplayMode(appearanceSetting);
      const manualSubscriptionsDisplayMode = normalizeManualSubscriptionsDisplayMode(appearanceSetting);
      const editorGroupingMode = normalizeEditorGroupingMode(appearanceSetting);

      this.appearanceSetting.isSimpleMode = appearanceSetting?.isSimpleMode ?? true;
      this.appearanceSetting.isLeftRight = appearanceSetting?.isLeftRight ?? false;
      this.appearanceSetting.isDefaultIcon = appearanceSetting?.isDefaultIcon ?? false;
      this.appearanceSetting.isIconColor = appearanceSetting?.isIconColor ?? false;
      this.appearanceSetting.isShowIcon = appearanceSetting?.isShowIcon ?? true;
      this.appearanceSetting.isSimpleShowRemark = appearanceSetting?.isSimpleShowRemark ?? false;
      this.appearanceSetting.editorCommonDisplayMode = editorCommonDisplayMode;
      this.appearanceSetting.manualSubscriptionsDisplayMode = manualSubscriptionsDisplayMode;
      this.appearanceSetting.editorGroupingMode = editorGroupingMode;
      this.appearanceSetting.isEditorCommon = editorCommonDisplayMode !== "hidden";
      this.appearanceSetting.isSimpleReicon = appearanceSetting?.isSimpleReicon ?? false;
      this.appearanceSetting.isSubItemMenuFold = appearanceSetting?.isSubItemMenuFold ?? true;
      this.appearanceSetting.showFloatingRefreshButton = appearanceSetting?.showFloatingRefreshButton ?? false;
      this.appearanceSetting.showFloatingAddButton = appearanceSetting?.showFloatingAddButton ?? false;
      this.appearanceSetting.createItemPosition = appearanceSetting?.createItemPosition ?? "bottom";
      this.appearanceSetting.displayPreviewInWebPage = appearanceSetting?.displayPreviewInWebPage ?? true;
      this.appearanceSetting.subProgressStyle = appearanceSetting?.subProgressStyle ?? "hidden";
      this.appearanceSetting.listPageViewMode = appearanceSetting?.listPageViewMode;
      this.appearanceSetting.listPageViewModeInWideScreenNarrowMode =
        appearanceSetting?.listPageViewModeInWideScreenNarrowMode ?? cachedNarrowModeListPageViewMode;
      this.appearanceSetting.useNarrowModeOnWideScreen = appearanceSetting?.useNarrowModeOnWideScreen ?? false;

      syncCachedListPageViewMode(LIST_PAGE_VIEW_MODE_STORAGE_KEY, this.appearanceSetting.listPageViewMode);
      syncCachedListPageViewMode(
        NARROW_MODE_LIST_PAGE_VIEW_MODE_STORAGE_KEY,
        this.appearanceSetting.listPageViewModeInWideScreenNarrowMode,
      );

      if (this.appearanceSetting.useNarrowModeOnWideScreen) {
        localStorage.setItem(WIDE_SCREEN_NARROW_MODE_STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(WIDE_SCREEN_NARROW_MODE_STORAGE_KEY);
      }

    },
    async fetchSettings() {
      const { showNotify } = useAppNotifyStore();
      const res = await runFrontendRequestTask(() => settingsApi.getSettings(), "settings.getSettings");
      if (res?.data?.status === "success" && res?.data?.data) {
        this.githubProxy = res.data.data.githubProxy || "";
        this.githubProxyRegex = res.data.data.githubProxyRegex || "";
        this.defaultUserAgent = res.data.data.defaultUserAgent || "";
        this.defaultFlowUserAgent = res.data.data.defaultFlowUserAgent || "";
        this.defaultTimeout = res.data.data.defaultTimeout || "";
        this.backendRequestConcurrency = normalizeSettingInputValue(res.data.data.backendRequestConcurrency);
        this.backendRequestConcurrencyWaitTime = normalizeSettingInputValue(res.data.data.backendRequestConcurrencyWaitTime);
        this.syncTime = res.data.data.syncTime || 0;
        this.avatarUrl = res.data.data.avatarUrl || "";

        this.theme.auto = res.data.data.theme?.auto ?? true;
        this.theme.name = res.data.data.theme?.name ?? "light";
        this.theme.dark = res.data.data.theme?.dark ?? "dark";
        this.theme.light = res.data.data.theme?.light ?? "light";

        this.hasFetchedSettings = true;
        this.applyAppearanceSetting(res.data.data.appearanceSetting);
      } else {
        this.hasFetchedSettings = false;
        showNotify({
          title: t("myPage.notify.save.configLoadFailed"),
          type: "danger",
        });
      }
    },
    async changeSettings(data: SettingsPostData) {
      const { showNotify } = useAppNotifyStore();
      const res = await settingsApi.setSettings(data);
      if (res?.data?.status === "success" && res?.data?.data) {
        this.githubProxy = res.data.data.githubProxy || "";
        this.githubProxyRegex = res.data.data.githubProxyRegex || "";
        this.defaultUserAgent = res.data.data.defaultUserAgent || "";
        this.defaultFlowUserAgent = res.data.data.defaultFlowUserAgent || "";
        this.defaultTimeout = res.data.data.defaultTimeout || "";
        this.backendRequestConcurrency = normalizeSettingInputValue(res.data.data.backendRequestConcurrency);
        this.backendRequestConcurrencyWaitTime = normalizeSettingInputValue(res.data.data.backendRequestConcurrencyWaitTime);
        this.avatarUrl = res.data.data.avatarUrl || "";
        showNotify({ type: "success", title: t(`myPage.notify.save.succeed`) });
        return true;
      } else {
        showNotify({
          title: t("myPage.notify.save.configUpdateFailed"),
          type: "danger",
        });
        return false;
      }
    },
    async changeTheme(data: SettingsPostData) {
      Toast.loading(t("myPage.notify.save.themeLoading"), { cover: true, id: "theme__loading" });
      const { showNotify } = useAppNotifyStore();
      const res = await settingsApi.setSettings(data);
      if (res?.data?.status === "success" && res?.data?.data) {
        this.theme = res.data.data.theme;
      } else {
        showNotify({
          title: t("myPage.notify.save.themeFailed"),
          type: "danger",
        });
      }
      Toast.hide("theme__loading");
    },
  },
});
