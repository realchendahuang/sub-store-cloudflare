import { nextTick } from 'vue';
import { useEnvApi } from '@/api/env';
import { useCloudflareApi } from '@/api/app';
import i18n from '@/locales';

import AppLayout from '@/layout/AppLayout.vue';
import { useGlobalStore } from '@/store/global';
import { useSubsStore } from '@/store/subs';
import { initStores } from '@/utils/initApp';

import Sub from '@/views/Sub.vue';

import { Toast } from '@nutui/nutui';
import { toRaw } from 'vue';
import 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';

let globalStore = null;
const { t: i18n_global } = i18n.global;

const scrollContainers = ['#app', '.app-layout-wrapper', '.page-body'];

const isTabRoute = (route?: { meta?: { needTabBar?: boolean } }) => route?.meta?.needTabBar === true;

const isTabSwitch = (
  to?: { path?: string; meta?: { needTabBar?: boolean } },
  from?: { path?: string; meta?: { needTabBar?: boolean } },
) => Boolean(to?.path && from?.path && to.path !== from.path && isTabRoute(to) && isTabRoute(from));

const resetDocumentScrollStyles = () => {
  ['html', 'body', '#app'].forEach(selector => {
    const element = document.querySelector(selector) as HTMLElement | null;

    if (!element) return;

    element.style['overflow-y'] = '';
    element.style.height = '';
  });
};

const getElementScrollTop = (selector: string) => {
  return (document.querySelector(selector) as HTMLElement | null)?.scrollTop || 0;
};

const getCurrentScrollTop = () => {
  return document.documentElement.scrollTop
    || document.body.scrollTop
    || getElementScrollTop('#app')
    || getElementScrollTop('.app-layout-wrapper')
    || getElementScrollTop('.page-body')
    || 0;
};

const scrollToPosition = (top = 0) => {
  window.scrollTo({ left: 0, top, behavior: "instant" as any });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;

  scrollContainers.forEach(selector => {
    document.querySelector(selector)?.scrollTo?.({ left: 0, top });
  });
};

declare module 'vue-router' {
  interface RouteMeta {
    title: string;
    needTabBar: boolean;
    needNavBack: boolean;
    supportsListViewMode?: boolean;
    supportsListSearch?: boolean;
    hideSideBarInWideScreenNarrowMode?: boolean;
  }
}

const history = createWebHistory();
const router = createRouter({
  history,
  routes: [
    {
      path: '/',
      component: AppLayout,
      redirect: '/subs',
      children: [
        {
          path: '/subs',
          component: Sub,
          meta: {
            title: 'sub',
            needTabBar: true,
            needNavBack: false,
            supportsListViewMode: true,
            supportsListSearch: true,
          },
        },
        {
          path: '/my',
          component: () => import('@/views/My.vue'),
          meta: {
            title: 'my',
            needTabBar: true,
            needNavBack: false,
          },
        },
        {
          path: '/tools',
          component: () => import('@/views/Tools.vue'),
          meta: {
            title: 'tools',
            needTabBar: true,
            needNavBack: false,
          },
        },
        {
          path: '/preview',
          component: () => import('@/views/Preview.vue'),
          meta: {
            title: 'preview',
            needTabBar: false,
            needNavBack: false,
          },
        },
        {
          path: '/edit/:editType(subs|collections)/:id',
          component: () => import('@/views/SubEditor.vue'),
          meta: {
            title: 'subEditor',
            needTabBar: false,
            needNavBack: true,
          },
        },
      ],
    },
    {
      path: '/404',
      component: () => import('@/views/NotFound.vue'),
      meta: {
        title: 'notFound',
        needTabBar: false,
        needNavBack: true,
      },
    },
    {
      path: '/:pathMatch(.*)',
      component: () => import('@/views/NotFound.vue'),
      meta: {
        title: 'notFound',
        needTabBar: false,
        needNavBack: true,
      },
    },
  ],
});

// 全局前置守卫
router.afterEach(async (to, from) => {
  resetDocumentScrollStyles();
  if (to?.path && from?.path !== to?.path) {
    const shouldResetTabScroll = isTabSwitch(to, from);
    let scrollTop = 0;
    if (to?.meta?.needTabBar && globalStore !== null && !shouldResetTabScroll) {
      const savedPositions = toRaw(globalStore.savedPositions);
      if (savedPositions[to.path]?.top) {
        scrollTop = savedPositions[to.path]?.top
      }
    }
    await nextTick()
    scrollToPosition(scrollTop);

    if (shouldResetTabScroll) {
      requestAnimationFrame(() => scrollToPosition(0));
    }
  }
});
router.beforeEach((to, from) => {
  document.title = 'Sub Store';
  if (to?.path !== '/subs') {
    useSubsStore().cancelFetchFlows();
  }
  if (!globalStore) {
    globalStore = useGlobalStore();
  }
  if (globalStore) {
    if (from?.meta?.needTabBar && from?.path !== to?.path) {
        const scrollTop = isTabSwitch(to, from) ? 0 : getCurrentScrollTop();
        globalStore.setSavedPositions(from.path, { left: 0, top: scrollTop })
      }
  }
  return true
})
router.beforeResolve(async (to, from) => {
  // document.body.classList.remove('nut-overflow-hidden');
  if (!globalStore) {
    globalStore = useGlobalStore();
  }
  // 路由跳转时查询环境，决定是否更新数据
  if (globalStore !== null) {
    const storeEnv = toRaw(globalStore.env);
    if (storeEnv?.backend && storeEnv?.version) {
      useEnvApi()
      .getEnv()
      .then(async res => {
        const envNow = res;
        if (envNow?.data?.status === 'success') {
          const backend = envNow.data.data.backend;
          const version = envNow.data.data.version;
          if (backend !== storeEnv.backend || version !== storeEnv.version) {
            Toast.loading(i18n_global("globalNotify.refresh.backendChanged"), {
              cover: true,
              id: 'fetchLoading',
            });
            await initStores(false, true, true);
            Toast.hide('fetchLoading');
          }
        }
      });
    }
  } else {
    globalStore = useGlobalStore();
  }

  // 进入编辑页面前查询是否存在订阅
  if (to.fullPath.startsWith('/edit/')) {
    const name = (to.params.id || to.params.name) as string;
    if (!['UNTITLED', 'UNTITLED-mihomoProfile'].includes(name)) {
      try {
        if (to.params.editType === 'subs') {
          await useCloudflareApi().getOne('sub', name);
        } else if (to.params.editType === 'collections') {
          await useCloudflareApi().getOne('collection', name);
        }
      } catch {
        router.replace('/404');
      }
    }
  }
  // 允许跳转
  return true;
});

export default router;
