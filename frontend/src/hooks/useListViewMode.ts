import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useRoute } from "vue-router";

import { useListPageViewStore } from "@/store/listPageView";
import { SIDEBAR_EXPANDED_BREAKPOINT, useSystemStore } from "@/store/system";

export const LIST_VIEW_MODE_BREAKPOINT = SIDEBAR_EXPANDED_BREAKPOINT;

export const useListViewMode = () => {
  const route = useRoute();
  const listPageViewStore = useListPageViewStore();
  const systemStore = useSystemStore();

  const { singleColumnLockRoutePath } = storeToRefs(listPageViewStore);
  const { screenWidth } = storeToRefs(systemStore);

  const supportsListViewMode = computed(() => Boolean(route.meta?.supportsListViewMode));
  const isWideListViewport = computed(() => screenWidth.value >= LIST_VIEW_MODE_BREAKPOINT);
  const isListViewModeLockedBySelection = computed(() => {
    return supportsListViewMode.value && isWideListViewport.value && singleColumnLockRoutePath.value === route.path;
  });

  const effectiveListViewMode = computed<ListPageViewMode>(() => {
    if (!supportsListViewMode.value || !isWideListViewport.value || isListViewModeLockedBySelection.value) {
      return "single-column";
    }

    return "dual-column";
  });

  return {
    supportsListViewMode,
    isWideListViewport,
    isListViewModeLockedBySelection,
    effectiveListViewMode,
  };
};
