<template>
  <div
    style="overflow: hidden"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- 添加订阅弹窗 -->
    <!-- lock-scroll -->
    <div>
      <nut-popup
        v-model:visible="addSubBtnIsVisible"
        pop-class="add-sub-popup"
        position="bottom"
        :style="{
          height: 'calc(200px + env(safe-area-inset-bottom))',
          padding: '20px 12px 0 12px',
        }"
        close-icon="close-little"
        z-index="11000"
        closeable
        round
      >
        <div class="title-btn">
          <p class="add-sub-panel-title">{{ $t(`subPage.addSubTitle`) }}</p>
          <p class="add-sub-panel-title or">{{ $t(`specificWord.or`) }}</p>
          <input ref="fileInput" type="file" accept="application/json,text/json,.json" style="display: none" @change="fileChange">
          <nut-button
            class="upload-btn"
            plain
            type="primary"
            size="small"
            :disabled="restoreIsLoading"
            :loading="restoreIsLoading"
            @click="upload()"
          >
            <font-awesome-icon
              v-if="!uploadIsLoading"
              icon="fa-solid fa-file-import"
            />
            {{ $t(`subPage.import.label`) }}
          </nut-button>
          <nut-icon name="tips" @click="importTips"></nut-icon>
        </div>
        <ul class="add-sub-panel-list">
          <li>
            <router-link to="/edit/subs/UNTITLED" class="router-link">
              <svg-icon name="singleSubs" />
              <span>{{ $t(`specificWord.singleSub`) }}</span>
            </router-link>
          </li>
          <li>
            <router-link to="/edit/collections/UNTITLED" class="router-link">
              <svg-icon name="collectionSubs" />
              <span>{{ $t(`specificWord.collectionSub`) }}</span>
            </router-link>
          </li>
        </ul>
      </nut-popup>
    </div>
    <!-- 浮动按钮 -->
    <Teleport to="body">
      <div v-if="hasSubs || hasCollections" class="drag-btn-wrapper">
        <nut-drag
          :attract="true"
          :boundary="{
            top: 56 + 8,
            left: 16,
            bottom: 48 + 12 + 8,
            right: 16,
          }"
          :style="{
            cursor: 'pointer',
            left: '15px',
            bottom: `calc(${
              48 + 36 +
              (!isMobile() ? (appearanceSetting.isSimpleMode ? 44 : 48) : 0)
            }px + env(safe-area-inset-bottom))`,
          }"
        >
          <!-- 刷新 -->
          <div
            v-if="appearanceSetting.showFloatingRefreshButton"
            class="drag-btn refresh"
            role="button"
            tabindex="0"
            :aria-label="t('navBar.actions.refresh')"
            @click="refresh"
            @keydown.enter="refresh"
          >
            <font-awesome-icon icon="fa-solid fa-arrow-rotate-right" />
          </div>

          <!-- 加号 -->
          <div
            v-if="appearanceSetting.showFloatingAddButton"
            class="drag-btn"
            role="button"
            tabindex="0"
            :aria-label="t('navBar.actions.add')"
            @touchmove="onTa"
            @touchend="enTa"
            @click="addSub"
            @keydown.enter="addSub"
          >
            <font-awesome-icon icon="fa-solid fa-plus" />
          </div>
        </nut-drag>
      </div>
    </Teleport>

    <!-- 页面内容 -->
    <!-- 有数据 -->
    <div v-if="hasSubs" class="subs-list-wrapper" :class="{ 'dual-column-mode': isDualColumnMode }">
      <div v-if="tags && tags.length > 0" ref="radioWrapperRef" class="radio-wrapper" >
        <!-- <nut-radiogroup v-model="tag" direction="horizontal"> -->
          <!-- <nut-radio v-for="i in tags" shape="button" :label="String(i.value)">{{ i.label }}</nut-radio> -->
          <span
            v-for="i in tags"
            :key="i.value"
            class="tag"
            :class="{ 'current': i.value === tag }"
            role="button"
            tabindex="0"
            :aria-pressed="i.value === tag"
            @click="setTag(i.value)"
            @keydown.enter="setTag(i.value)"
          >{{ i.label }}</span>
        <!-- </nut-radiogroup> -->
      </div>
      <div class="subs-list-container" :style="{ paddingTop: `${radioWrapperHeight}px` }">
        <section v-if="hasSubs && !hasCollections" class="onboarding-card onboarding-inline">
          <div>
            <span class="onboarding-kicker">{{ $t('subPage.onboarding.step2') }}</span>
            <h3>{{ $t('subPage.onboarding.collectionTitle') }}</h3>
            <p>{{ $t('subPage.onboarding.collectionDesc') }}</p>
          </div>
          <router-link to="/edit/collections/UNTITLED" class="onboarding-action">
            <nut-button type="primary" size="small">{{ $t('subPage.onboarding.createCollection') }}</nut-button>
          </router-link>
        </section>
        <div v-if="filterdSubsCount > 0" class="subs-list-content">
          <div class="title-wrappers">
            <p
              class="list-title"
              role="button"
              tabindex="0"
              :aria-expanded="!isFold('sub')"
              @click="toggleFold('sub')"
              @keydown.enter="toggleFold('sub')"
            >
              <span class="list-title-text">{{ `${$t(`specificWord.singleSub`)  }(${filterdSubsCount})` }}</span>
              <nut-icon v-if="!isFold('sub')" name="rect-down" size="12px"></nut-icon>
              <nut-icon v-else name="rect-right" size="12px"></nut-icon>
            </p>
          </div>

          <draggable
            v-if="!isFold('sub')"
            class="list-draggable"
            :class="{ 'dual-column': isDualColumnMode }"
            v-model="filteredSubs"
            item-key="name"
            :scroll-sensitivity="200"
            :force-fallback="true"
            :scroll-speed="8"
            :scroll="true"
            v-bind="{
              animation: 200,
              disabled: false,
              delay: 200,
              chosenClass: 'chosensub',
              handle: 'div',
            }"
            @change="changeSort('subs', subs)"
            @start="handleDragStart(subs)"
            @end="handleDragEnd(subs)"
          >
            <template #item="{ element }">
              <div :key="element.name" class="draggable-item">
                <SubListItem
                  :sub="element"
                  type="sub"
                  :disabled="swipeDisabled"
                  :is-dual-column="isDualColumnMode"
                />
              </div>
            </template>
          </draggable>
        </div>
        <div v-if="filterdColsCount > 0" class="subs-list-content">
          <div class="title-wrappers">
            <p
              class="list-title"
              role="button"
              tabindex="0"
              :aria-expanded="!isFold('col')"
              @click="toggleFold('col')"
              @keydown.enter="toggleFold('col')"
            >
              <span class="list-title-text">{{ `${$t(`specificWord.collectionSub`)  }(${filterdColsCount})`}}</span>
              <nut-icon v-if="!isFold('col')" name="rect-down" size="12px"></nut-icon>
              <nut-icon v-else name="rect-right" size="12px"></nut-icon>
            </p>
          </div>

          <draggable
            v-if="!isFold('col')"
            class="list-draggable"
            :class="{ 'dual-column': isDualColumnMode }"
            v-model="filteredCollections"
            item-key="name"
            :scroll-sensitivity="200"
            :force-fallback="true"
            :scroll-speed="8"
            :scroll="true"
            v-bind="{
              animation: 200,
              disabled: false,
              delay: 200,
              chosenClass: 'chosensub',
              handle: 'div',
            }"
            @change="changeSort('collections', collections)"
            @start="handleDragStart(collections)"
            @end="handleDragEnd(collections)"
          >
            <template #item="{ element }">
              <div :key="element.name" class="draggable-item">
                <SubListItem
                  :collection="element"
                  type="collection"
                  :disabled="swipeDisabled"
                  :is-dual-column="isDualColumnMode"
                />
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>
    <!-- 没有数据 -->
    <div
      v-if="!isLoading && fetchResult && !hasSubs"
      class="empty-state-wrapper"
    >
      <section class="onboarding-card onboarding-empty">
        <img class="empty-state-image" :src="logoRedIcon" alt="" />
        <span class="onboarding-kicker">{{ $t('subPage.onboarding.welcome') }}</span>
        <h3>{{ $t('subPage.onboarding.title') }}</h3>
        <p class="onboarding-desc">{{ $t('subPage.onboarding.desc') }}</p>
        <ol class="onboarding-steps">
          <li><strong>1</strong><span>{{ $t('subPage.onboarding.addSource') }}</span></li>
          <li><strong>2</strong><span>{{ $t('subPage.onboarding.addCollection') }}</span></li>
          <li><strong>3</strong><span>{{ $t('subPage.onboarding.copyLink') }}</span></li>
        </ol>
        <div class="onboarding-buttons">
          <router-link to="/edit/subs/UNTITLED" class="onboarding-action">
            <nut-button type="primary">{{ $t('subPage.onboarding.createSource') }}</nut-button>
          </router-link>
          <a href="https://github.com/realchendahuang/sub-store-cloudflare/blob/main/docs/quick-start.md" target="_blank" rel="noreferrer">
            {{ $t('subPage.onboarding.openGuide') }}
          </a>
        </div>
      </section>
    </div>

    <!-- 数据加载失败 -->
    <div v-if="!isLoading && !fetchResult" class="empty-state-wrapper">
      <nut-empty style="padding: 32px 30px">
        <template #image>
          <img class="empty-state-image" :src="logoRedIcon" alt="" />
        </template>
        <template #description>
          <h3>{{ $t(`subPage.loadFailed.title`) }}</h3>
          <p>{{ $t(`subPage.loadFailed.desc`) }}</p>
        </template>
      </nut-empty>
      <form class="load-failed-form" @submit.prevent="saveTokenAndRetry">
        <label for="admin-token">{{ $t(`subPage.loadFailed.tokenLabel`) }}</label>
        <input
          id="admin-token"
          v-model="adminToken"
          type="password"
          autocomplete="current-password"
          :placeholder="$t(`subPage.loadFailed.tokenPlaceholder`)"
          spellcheck="false"
        />
        <nut-button
          native-type="submit"
          type="primary"
          :disabled="!adminToken.trim()"
          @click="saveTokenAndRetry"
        >
          {{ $t(`subPage.loadFailed.saveAndRetry`) }}
        </nut-button>
      </form>
      <div class="load-failed-actions">
        <nut-button plain icon="refresh" @click="refresh">
          {{ $t(`subPage.loadFailed.btn`) }}
        </nut-button>
        <a
          href="https://github.com/realchendahuang/sub-store-cloudflare/blob/main/docs/deployment.md"
          target="_blank"
          rel="noreferrer"
        >
          {{ $t(`subPage.loadFailed.doc`) }}
          <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
        </a>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Dialog } from '@nutui/nutui';
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from 'vue-router';
import draggable from "vuedraggable";

import { useCloudflareApi } from "@/api/app";
import logoRedIcon from "@/assets/icons/logo-red.png";
import SubListItem from "@/components/SubListItem.vue";
import { useFilteredDraggableList } from "@/hooks/useFilteredDraggableList";
import { useListViewMode } from "@/hooks/useListViewMode";
import { useTagBarHeight } from "@/hooks/useTagBarHeight";
import { useAppNotifyStore } from "@/store/appNotify";
import { useGlobalStore } from "@/store/global";
import { useSystemStore } from "@/store/system";
import { useListSearchStore } from "@/store/listSearch";
import { useMethodStore } from '@/store/methodStore';
import { useSettingsStore } from '@/store/settings';
import { useSubsStore } from "@/store/subs";
import { initStores } from "@/utils/initApp";
import { adminTokenState, getStoredAdminToken, setStoredAdminToken } from "@/utils/adminToken";
import { listItemMatchesSearch, shouldSearchListRemark } from "@/utils/listSearch";
import { isMobile } from "@/utils/isMobile";
const { showNotify } = useAppNotifyStore();
const cloudflareApi = useCloudflareApi();
const { t } = useI18n();
const fileInput = ref(null);
const uploadIsLoading = ref(false);
const restoreIsLoading = ref(false);
const addSubBtnIsVisible = ref(false);
const adminToken = ref(getStoredAdminToken());
// 登出 / 401 清除 token 后，同步清空输入框
watch(adminTokenState, (value) => {
  adminToken.value = value;
});
// const isSubFold = ref(localStorage.getItem('sub-fold') === '1');
// const isColFold = ref(localStorage.getItem('col-fold') === '1');
const methodStore = useMethodStore();
const subsStore = useSubsStore();
const globalStore = useGlobalStore();
const systemStore = useSystemStore();
const settingsStore = useSettingsStore();
const listSearchStore = useListSearchStore();
const { hasSubs, hasCollections, subs, collections } = storeToRefs(subsStore);
const { appearanceSetting } = storeToRefs(settingsStore);
const { effectiveListViewMode } = useListViewMode();
const {
  // isSimpleMode,
  isLoading,
  fetchResult,
  // showFloatingRefreshButton,
} = storeToRefs(globalStore);
const { navBarHeight } = storeToRefs(systemStore);
const isDualColumnMode = computed(() => {
  return effectiveListViewMode.value === "dual-column";
});
const swipeDisabled = ref(false);
const touchStartY = ref(null);
const touchStartX = ref(null);
const sortFailed = ref(false);
const hasUntagged = ref(false);
const hasLocal = ref(false);
const hasRemote = ref(false);
const tagNavBarHeight = computed(() => {
  return navBarHeight.value;
});
const getTag = () => {
    return localStorage.getItem('sub-tag') || 'all';
  };
const tag = ref(getTag());
const tags = computed(() => {
  if(!hasSubs.value && !hasCollections.value) return [];
  // 从 subs 和 collections 中获取所有的 tag, 去重
  const set = new Set();
  subs.value.forEach(sub => {
    if(sub.source === 'remote') {
      hasRemote.value = true;
    } else {
      hasLocal.value = true;
    }
    if (Array.isArray(sub.tag) && sub.tag.length > 0) {
      sub.tag.forEach(i => {
        set.add(i);
      });
    } else {
      hasUntagged.value = true;
    }
  });
  collections.value.forEach(col => {
    if (Array.isArray(col.tag) && col.tag.length > 0) {
      col.tag.forEach(i => {
        set.add(i);
      });
    } else {
      hasUntagged.value = true;
    }
  });

  let tags: any[] = Array.from(set);
  if(tags.length === 0 && !hasRemote.value && !hasLocal.value) return [];
  tags = tags.map(i => ({ label: i, value: i }));
  
  const result = [{ label: t("specificWord.all"), value: "all" }, ...tags];
  if(hasRemote.value) result.push({ label: t("editorPage.subConfig.basic.source.remote"), value: "remote" });
  if(hasLocal.value) result.push({ label: t("editorPage.subConfig.basic.source.local"), value: "local" });
  if(tags.length > 0 && hasUntagged.value) result.push({ label: t("specificWord.untagged"), value: "untagged" });

  if (!result.find(i => i.value === tag.value)) {
    tag.value = 'all';
  }
  return result;
});
const filterdSubsCount = computed(() => {
  return subs.value.filter(shouldShowElement).length;
});
const filterdColsCount = computed(() => {
  return collections.value.filter(shouldShowElement).length;
});
const onTouchStart = (event: TouchEvent) => {
  touchStartY.value = Math.abs(event.touches[0].clientY);
  touchStartX.value = Math.abs(event.touches[0].clientX);
};

const onTouchMove = (event: TouchEvent) => {
  const deltaY = Math.abs(event.changedTouches[0].clientY - touchStartY.value);
  const deltaX = Math.abs(event.changedTouches[0].clientX - touchStartX.value);

  const isScrollingUp = deltaX > 2;
  const isScrollingUps = deltaY < 10;

  if (isScrollingUp && isScrollingUps) {
    event.preventDefault();
  }
};

const onTouchEnd = () => {
  touchStartY.value = null;
  touchStartX.value = null;
};

const refresh = async () => {
  await initStores(true, true, { forceFlows: true });
};

const saveTokenAndRetry = async () => {
  setStoredAdminToken(adminToken.value);
  adminToken.value = getStoredAdminToken();
  await refresh();
};

const as = ref(false);

const onTa = () => {
  as.value = true;
};

const enTa = () => {
  setTimeout(() => {
    as.value = false;
  }, 100);
};

const addSub = () => {
  if (as.value) return;
  addSubBtnIsVisible.value = true;
};

const route = useRoute();
const { tagBarRef: radioWrapperRef, tagBarHeight: radioWrapperHeight } = useTagBarHeight([
  tag,
  () => tags.value,
]);

onMounted(() => {
  methodStore.registerMethod("addSub", addSub);
  refreshMissingFlows();
});

const refreshMissingFlows = async () => {
  if (route.path !== "/subs" || isLoading.value || !fetchResult.value) return;
  try {
    await subsStore.fetchFlows(undefined, { missingOnly: true });
  } catch (error) {
    console.error(error);
  }
};

let dragData = null;
const changeSort = async (
  subColl: "subs" | "collections",
  dataValue: any[]
) => {
  try {
    const nameSortArray = dataValue.map((k: { name: string }) => k.name);
    const sortDataRes = await cloudflareApi.reorderItems(
      subColl,
      JSON.parse(JSON.stringify(toRaw(nameSortArray)))
    );
    if (sortDataRes?.data?.status !== "success") {
      sortFailed.value = true;
      showNotify({
        title: t("subPage.sort.failed"),
        type: "danger",
        content: JSON.stringify(sortDataRes),
      });
    }
  } catch (error) {
    sortFailed.value = true;
  }
};

const handleDragStart = (dataValue: any) => {
  swipeDisabled.value = true;
  dragData = dataValue.value;
};

const handleDragEnd = (dataValue: any) => {
  if (sortFailed.value) {
    dataValue.value = dragData;
  } else {
    dragData = null;
  }
  swipeDisabled.value = false;
};
function getFoldState() {
  let states = {};
  try {
    const raw = localStorage.getItem('sub-fold');
    states = raw ? JSON.parse(raw) : {};
  } catch (e) {}
  return states;
}
const fold = ref(getFoldState());
const isFold = (type) => {
  return fold.value?.[type]?.[tag.value];
};
const toggleFold = (type) => {
  if (fold.value?.[type]?.[tag.value]) {
    delete fold.value[type][tag.value];
  } else {
    if (!fold.value[type]) {
      fold.value[type] = {};
    }
    fold.value[type][tag.value] = 1;
  }
  localStorage.setItem('sub-fold', JSON.stringify(fold.value));
};
// const toggleSubFold = () => {
//   isSubFold.value = !isSubFold.value;
//   if (isSubFold.value) {
//     localStorage.setItem('sub-fold', '1')  
//   } else {
//     localStorage.removeItem('sub-fold')
//   }
// };
// const toggleColFold = () => {
//   isColFold.value = !isColFold.value;
//   if (isColFold.value) {
//     localStorage.setItem('col-fold', '1')  
//   } else {
//     localStorage.removeItem('col-fold')
//   }
// };

const scrollToTop = () => {
  const scrollPosition = 0;
  
  window.scrollTo({
    top: scrollPosition,
    behavior: "smooth"
  });
};

const setTag = (current) => {
  tag.value = current;
  if (current === 'all') {
    localStorage.removeItem('sub-tag');
  } else {
    localStorage.setItem('sub-tag', current);
  }
  // 增加滚动到顶部
  scrollToTop();
};

const shouldShowElementByTag = (element) => {
  if(tag.value === 'all') return true;
  if(tag.value === 'untagged') return !Array.isArray(element.tag) || element.tag.length === 0;
  if(tag.value === 'remote') return element.source === 'remote';
  if(tag.value === 'local') return element.source === 'local';
  return element.tag?.includes(tag.value);
};
const shouldShowElement = (element) => {
  return shouldShowElementByTag(element)
    && listItemMatchesSearch(element, listSearchStore.normalizedQuery, {
      includeRemark: shouldSearchListRemark(appearanceSetting.value),
    });
};
const filteredSubs = useFilteredDraggableList(subs, shouldShowElement);
const filteredCollections = useFilteredDraggableList(collections, shouldShowElement);
const upload = async() => {
  try {
    fileInput.value.click();
  } catch (e) {
    console.error(e);
  }
};

const fileChange = async (event) => {
  const file = event.target.files[0];
  if(!file) return;
  try {
    restoreIsLoading.value = true;
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      const item = JSON.parse(String(reader.result));
      const suffix = new Date().getTime();
      item.name += `_${suffix}`;
      item.displayName += `_${suffix}`;
      item['display-name'] = item.displayName;
      const res = await cloudflareApi.createItem(item.subscriptions ? 'collections' : 'subs', item);
      // await subsStore.fetchSubsData();
      
      if (res?.data?.status === "success") {
        await initStores(false, true);
        showNotify({
          type: "success",
          title: t(`subPage.import.succeed`),
        });
        addSubBtnIsVisible.value = false;
      } else {
        throw new Error('restore failed');
      }
    };

    reader.onerror = e => {
      throw e;
    };
    
  } catch (e) {
    showNotify({
      type: "danger",
      title: t(`subPage.import.failed`, { e: e.message ?? e }),
    });
    console.error(e);
  } finally {
    restoreIsLoading.value = false;
  }
};
const importTips = () => {
  addSubBtnIsVisible.value = false;
  Dialog({
      title: t(`subPage.import.tipsTitle`),
      content: t(`subPage.import.tipsContent`),
      popClass: 'auto-dialog',
      okText: 'OK',
      noCancelBtn: true,
      closeOnPopstate: true,
      lockScroll: false,
    });
};
</script>

<style lang="scss" scoped>
.drag-btn-wrapper {
  position: relative;
  z-index: 999;

  .drag-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-image: linear-gradient(
      to bottom right,
      var(--primary-color),
      var(--primary-color-end)
    );
    box-shadow: 0 4px 8px #0003;
    display: flex;
    justify-content: center;
    align-items: center;

    &.refresh {
      background: var(--second-color);
      margin-bottom: 12px;
    }

    > svg {
      width: 20px;
      height: 20px;
      color: #fffb;
    }
  }
}

.load-failed-form {
  width: min(100%, 420px);
  display: grid;
  gap: 10px;
  padding: 0 20px;

  label {
    color: var(--second-text-color);
    font-size: 13px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    background: var(--card-color);
    color: var(--primary-text-color);
    padding: 12px 14px;
    font-size: 14px;
    outline: none;

    &:focus {
      border-color: var(--primary-color);
    }
  }
}

.empty-state-image {
  width: 96px;
  height: 96px;
  object-fit: contain;
}

.onboarding-card {
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, var(--divider-color));
  border-radius: var(--item-card-radios);
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 8%, var(--card-color)), var(--card-color));
  color: var(--second-text-color);

  h3 {
    margin: 4px 0 6px;
    color: var(--primary-text-color);
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--comment-text-color);
    font-size: 13px;
    line-height: 1.6;
  }
}

.onboarding-empty {
  width: min(calc(100% - 32px), 560px);
  padding: 24px;
  text-align: center;
}

.onboarding-inline {
  width: calc(100% - 1.5rem);
  margin: 12px auto 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.onboarding-kicker {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
}

.onboarding-desc {
  max-width: 460px;
  margin: 0 auto !important;
}

.onboarding-steps {
  margin: 18px 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    background: var(--background-color);
    color: var(--second-text-color);
    font-size: 12px;
    text-align: left;
  }

  strong {
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
  }
}

.onboarding-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;

  a:not(.onboarding-action) {
    color: var(--primary-color);
    font-size: 13px;
  }
}

.onboarding-action {
  display: inline-flex;
}

@media (max-width: 520px) {
  .onboarding-inline {
    align-items: flex-start;
    flex-direction: column;
  }

  .onboarding-steps {
    grid-template-columns: 1fr;
  }
}

.load-failed-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 14px;

  a {
    color: var(--primary-color);
    font-size: 14px;
  }
}

.add-sub-popup {
  background-color: var(--popup-color);
  // position: relative;
  .title-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 12px;
    .nut-icon {
      color: var(--comment-text-color);
    }
    :deep(.nut-icon-tips:before) {
      cursor: pointer;
      margin-left: 4px;
    }
  }
  .add-sub-panel-title {
    width: auto;
    text-align: center;
    font-size: 16px;
    color: var(--second-text-color);
    &.or {
      margin: 0 4px;
      color: var(--comment-text-color);
    }
  }

  .add-sub-panel-list {
    padding: 16px 0;
    font-size: 16px;
    font-weight: bold;
    display: flex;
    width: 100%;
    color: var(--second-text-color);

    > li {
      width: 50%;
      display: flex;
      justify-content: center;

      .router-link {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;

        > svg {
          width: 44px;
          height: 44px;
          color: var(--primary-color);
          margin-bottom: 12px;
        }
      }
    }
  }
}

.list-title {
  -webkit-user-select: none;
  user-select: none;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  cursor: pointer;
  padding-left: 8px;
  font-weight: bold;
  //padding-left: var(--safe-area-side);
  .list-title-text {
    margin-right: 6px;
  }
  :deep(.nut-icon) {
    // transform: rotate(270deg);
    font-size: 12px;
    height: 12px;
    opacity: .6;
    margin-top: 3px;
  }
}

.title-wrappers {
  // margin-top: var(--safe-area-side);
  // backdrop-filter: blur(var(--sticky-title-blur));
  // -webkit-backdrop-filter: blur(var(--sticky-title-blur));
  margin-top: 0;
  padding-top: 0;
  color: var(--comment-text-color);
}

.desc-about {
  display: block;
  padding: 100px 30px 50px;
  color: var(--comment-text-color);
  font-size: 12px;
  line-height: 20px;
  margin-top: 8px;
  margin-bottom: 20px;
  text-align: left;
}

.desc-about span {
  display: inline-block;
  padding: 6px 0 0 0;
}

.desc-title a,
.desc-about a {
  color: var(--primary-color);
}

.draggable-item {
  margin-top: 12px;
  margin-bottom: 12px;
  border-radius: var(--item-card-radios);
  overflow: hidden;
}

.chosensub {
  box-shadow: 0 0 10px var(--primary-color);
  border-radius: var(--item-card-radios);
  overflow: hidden;
}

.subs-list-wrapper {
  width: 100%;
  .list-draggable.dual-column {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
    padding-top: 12px;

    > .draggable-item {
      min-width: 0;
      margin: 0;
      border-radius: var(--item-card-radios);
      overflow: hidden;
    }
  }
  .radio-wrapper {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    position: fixed;
    padding: 10px;
    top: v-bind(tagNavBarHeight);
    z-index: 10;
    backdrop-filter: blur(var(--nav-bar-blur));
    -webkit-backdrop-filter: blur(var(--nav-bar-blur));
    background: var(--nav-bar-color);
    @include centered-fixed-container;
      @media screen and (min-width: 768px) {
        border-radius: var(--item-card-radios);
        overflow: hidden;
      }
    .tag {
      font-size: 12px;
      color: var(--second-text-color);
      margin: 0px 5px;
      padding: 7.5px 2.5px 4px;
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
      border-bottom: 1px solid transparent;
    }
    .current {
      border-bottom: 1px solid var(--primary-color);
      color: var(--primary-color);
    }
  }
  .subs-list-content {
    width: calc(100% - 1.5rem);
    margin-left: auto;
    margin-right: auto;
    margin-top: 0;
    padding: 0;
    // margin-top: var(--safe-area-side);
  }

  .subs-list-content + .subs-list-content {
    margin-top: 8px;
  }
}
</style>
