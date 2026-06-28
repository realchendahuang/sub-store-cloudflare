import { useMediaQuery } from "@vueuse/core";
import { computed } from "vue";
import { useRoute } from "vue-router";

import { SIDEBAR_BREAKPOINT } from "@/store/system";

export const WIDE_SCREEN_NARROW_MODE_BREAKPOINT = SIDEBAR_BREAKPOINT;
export const WIDE_SCREEN_NARROW_MODE_QUERY = `(min-width: ${WIDE_SCREEN_NARROW_MODE_BREAKPOINT}px)`;

export const useWideScreenNarrowMode = () => {
  const route = useRoute();
  const isWideScreen = useMediaQuery(WIDE_SCREEN_NARROW_MODE_QUERY);

  const isWideScreenNarrowModeActive = computed(() => false);

  const shouldShowTabBar = computed(() => {
    return Boolean(route.meta?.needTabBar) && !isWideScreen.value;
  });

  const shouldShowSideBar = computed(() => {
    if (route.path.startsWith("/preview") || !isWideScreen.value) {
      return false;
    }

    return !route.meta?.hideSideBarInWideScreenNarrowMode;
  });

  return {
    isWideScreen,
    isWideScreenNarrowModeActive,
    shouldShowTabBar,
    shouldShowSideBar,
  };
};
