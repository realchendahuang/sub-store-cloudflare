<template>
  <div class="app-layout-wrapper">
    <router-view />
  </div>
  <TabBar v-if="shouldShowTabBar" />
</template>

<script lang="ts" setup>
  import TabBar from '@/components/TabBar.vue';
  import { computed } from 'vue';
  import { useWideScreenNarrowMode } from '@/hooks/useWideScreenNarrowMode';

  const { shouldShowTabBar } = useWideScreenNarrowMode();

  const height = computed(() => {
    if (shouldShowTabBar.value) {
      return 'calc(var(--tab-bar-height) + env(safe-area-inset-bottom))';
    } else {
      return '16px';
    }
  });
</script>

<style scoped lang="scss">
  .app-layout-wrapper {
    flex: 1;
    padding: 56px 0 v-bind(height) 0;
    overflow: auto;
  }

</style>
