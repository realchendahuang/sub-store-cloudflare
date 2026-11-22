<template>
  <div class="tab-bar-wrapper" :class="{ 'is-wide-screen-visible': isWideScreenNarrowModeActive }">
    <nut-tabbar
      unactive-color=""
      v-model:visible="activeTab"
      :bottom="true"
      class="tabbar"
      size="22px"
    >
      <nut-tabbar-item class="tabbar-item" to="/subs" icon="link" :tab-title="t('tabBar.sub')" />
      <nut-tabbar-item class="tabbar-item" to="/tools" :tab-title="t('tabBar.tools')">
        <template #icon>
          <font-awesome-icon class="tabbar-fa-icon" icon="fa-solid fa-toolbox" />
        </template>
      </nut-tabbar-item>
      <nut-tabbar-item class="tabbar-item" to="/my" icon="setting" :tab-title="t('tabBar.my')" />
    </nut-tabbar>
  </div>
</template>

<script lang="ts" setup>
  import { useWideScreenNarrowMode } from '@/hooks/useWideScreenNarrowMode';
  import { ref } from 'vue';
  import { onBeforeRouteUpdate, useRoute } from 'vue-router';
  import { useI18n } from 'vue-i18n';

  const route = useRoute();
  const { t } = useI18n();
  const routeList = ['/subs', '/tools', '/my'];
  const activeTab = ref(routeList.indexOf(route.path));
  const { isWideScreenNarrowModeActive } = useWideScreenNarrowMode();

  onBeforeRouteUpdate((to, from, next) => {
    activeTab.value = routeList.indexOf(to.path);
    // const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    // globalStore.setSavedPositions(from.path, { left: 0, top: scrollTop })
    next();
  });
</script>

<style lang="scss" scoped>
  .tab-bar-wrapper {
    z-index: 101;
    bottom: 0;
    @include centered-fixed-container;

    @media screen and (min-width: 768px) {
      display: none !important;
    }

    &.is-wide-screen-visible {
      @media screen and (min-width: 768px) {
        display: block !important;
      }
    }

    .tabbar {
      box-sizing: border-box;
      // 高度 = 标签栏本体 + 底部安全区（index.html 已启用 viewport-fit=cover）
      height: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
      padding: 0 0 env(safe-area-inset-bottom);
      box-shadow: none;
      backdrop-filter: blur(var(--tab-bar-blur));
      -webkit-backdrop-filter: blur(var(--tab-bar-blur));
      background: var(--tab-bar-color);
      @media screen and (min-width: 768px) {
        border-radius: var(--item-card-radios);
        overflow: hidden;
      }
    }

    :deep(.tabbar-item) {
      cursor: pointer;
      &.nut-tabbar-item__icon--unactive {
        color: var(--lowest-text-color);
      }
      & > .nut-tabbar-item_icon-box > .nut-tabbar-item_icon-box_nav-word {
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.2;
        font-weight: 600;
      }
      .tabbar-fa-icon {
        display: block;
        width: 22px;
        height: 22px;
      }
      // nut-icon 外层是行内盒，会被行高撑高；与插槽图标统一成 22px 高的盒子，三个标签才能对齐
      & > .nut-tabbar-item_icon-box > view:not([class]),
      & > .nut-tabbar-item_icon-box > .nut-tabbar-item_icon-box_icon {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 22px;
      }
    }
  }
</style>
