<template>
  <div class="tab-panel-wrapper">
    <nut-tabs v-model="currentTab" type="smile" class="auto-tab-panel">
      <nut-tabpane :title="$t('comparePage.nodeInfo.node.title')">
        <ul class="info-ul">
          <li>
            <strong class="node-name">
              <nut-tag class="type-tag">{{ props.nodeInfo.type }} </nut-tag
              >{{ props.nodeInfo.name }}</strong
            >
          </li>
          <li v-for="(value, key) in displayNodeInfo" :key="key">
            <span class="info-key">{{ key }}</span>
            <span class="info-value"> : </span>
            <span class="info-value">{{ value }}</span>
          </li>
        </ul>
      </nut-tabpane>
      <nut-tabpane title="JSON">
        <div class="input-wrapper">
          <nut-textarea :model-value="JSON.stringify(props.nodeInfo, null, 2)" :rows="15" readonly/>
        </div>
      </nut-tabpane>
      <nut-tabpane :title="$t('comparePage.nodeInfo.ipApi.title')">
        <div v-if="ipLoading" class="ip-api-state ip-api-loading">{{ $t('comparePage.nodeInfo.ipApi.loading') }}</div>
        <div v-else-if="ipError" class="ip-api-state">
          <span class="state-title">{{ $t('comparePage.nodeInfo.ipApi.loadFailed') }}</span>
          <nut-button class="ip-api-retry-btn" plain type="primary" size="small" @click="loadIpInfo">{{ $t('comparePage.nodeInfo.ipApi.retry') }}</nut-button>
        </div>
        <ul v-else class="info-ul">
          <li v-for="(value, key) in ipInfo" :key="key">
            <span class="info-key">{{ key }}</span>
            <span class="info-value"> : {{ typeof value === 'object' ? JSON.stringify(value) : value }}</span>
          </li>
        </ul>
      </nut-tabpane>
    </nut-tabs>
  </div>
  <!-- lock-scroll -->
  <nut-overlay
    v-model:visible="overlayVisible"
    :z-index="1001"
    @click="closePanel"
  ></nut-overlay>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import { useCloudflareApi } from '@/api/app';

  const emit = defineEmits(['close']);
  const props = defineProps<{
    nodeInfo: NodeInfo;
  }>();

  const overlayVisible = ref(true);
  const currentTab = ref(0);
  const ipLoading = ref(false);
  const ipError = ref(false);
  const ipInfo = ref<Record<string, unknown>>({});
  const api = useCloudflareApi();

  const loadIpInfo = async () => {
    ipLoading.value = true;
    ipError.value = false;
    try {
      const response = await api.getNodeInfo({ server: props.nodeInfo.server });
      ipInfo.value = (response?.data as any)?.data || {};
    } catch {
      ipError.value = true;
    } finally {
      ipLoading.value = false;
    }
  };

  const displayNodeInfo = computed(() => {
    const result = {};
    Object.keys(props.nodeInfo).forEach(key => {
      switch (key) {
        case 'id':
        case 'type':
        case 'name':
          break;
        default:
          result[key] = props.nodeInfo[key];
          break;
      }
    });
    return result;
  });

  const closePanel = () => {
    emit('close');
  };

  onMounted(loadIpInfo);
</script>

<style lang="scss" scoped>
  .type-tag {
    color: var(--primary-color) !important;
    border: 1px solid var(--primary-color) !important;
    background: transparent !important;
    margin-right: 4px;
  }

  .node-name {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .info-ul {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 12px;

    li:first-child {
      margin-bottom: 20px;
    }

    li:not(:first-child) {
      margin-bottom: 8px;
      color: var(--comment-text-color);
    }
  }

  .ip-api-state {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    text-align: center;
  }

  .ip-api-loading {
    color: var(--comment-text-color);
  }

  .state-title {
    margin-top: 16px;
    color: var(--comment-text-color);
  }

  .ip-api-empty {
    padding: 16px 0 8px;
  }

  .ip-api-retry-btn {
    margin-top: 8px;
  }

  .input-wrapper {
    display: flex;
    align-items: center;

    >view.nut-textarea {
      background: transparent;
      padding: 8px 12px;
      // border-bottom: 1px solid;
      color: var(--second-text-color);
      border-color: var(--lowest-text-color);

      :deep(textarea) {
        color: inherit;
      }
    }
  }

  .qrcode {
    width: 92px;
    height: 92px;
    margin: 0 auto;
    opacity: 0.8;
  }
</style>
