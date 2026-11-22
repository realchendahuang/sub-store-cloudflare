<template>
  <div class="tools-page">
    <section class="tool-card">
      <h2>{{ t('toolsPage.converter.title') }}</h2>
      <p>{{ t('toolsPage.converter.desc') }}</p>
      <div class="row">
        <select v-model="conversionKind" :aria-label="t('toolsPage.converter.kind')">
          <option value="proxy">{{ t('toolsPage.converter.proxy') }}</option>
          <option value="rule">{{ t('toolsPage.converter.rule') }}</option>
        </select>
        <select v-model="conversionTarget" :aria-label="t('toolsPage.converter.target')">
          <option v-for="target in conversionTargets" :key="target" :value="target">{{ getTargetLabel(target) }}</option>
        </select>
      </div>
      <textarea v-model="conversionInput" :placeholder="t('toolsPage.converter.input')" />
      <div class="actions">
        <nut-button type="primary" :loading="converting" @click="runConversion">{{ t('toolsPage.converter.run') }}</nut-button>
        <nut-button plain type="primary" :disabled="!conversionOutput" @click="copyText(conversionOutput)">{{ t('toolsPage.converter.copy') }}</nut-button>
      </div>
      <textarea v-model="conversionOutput" readonly :placeholder="t('toolsPage.converter.output')" />
      <p v-if="conversionStats" class="stats">{{ conversionStats }}</p>
    </section>

    <section class="tool-card">
      <h2>{{ t('toolsPage.shares.title') }}</h2>
      <p>{{ t('toolsPage.shares.desc') }}</p>
      <form class="share-form" novalidate @submit.prevent="createShare">
        <label class="field">
          <span class="field-label">{{ t('toolsPage.shares.resourceType') }}</span>
          <select v-model="shareForm.resourceType">
            <option value="source">{{ t('toolsPage.resourceTypes.source') }}</option>
            <option value="collection">{{ t('toolsPage.resourceTypes.collection') }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('toolsPage.shares.resource') }}</span>
          <select v-model="shareForm.resourceId" :disabled="resourceOptions.length === 0">
            <option v-if="resourceOptions.length === 0" value="">{{ t('toolsPage.shares.noResource') }}</option>
            <option v-for="option in resourceOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('toolsPage.shares.target') }}</span>
          <select v-model="shareForm.target">
            <option value="">{{ t('toolsPage.shares.autoTarget') }}</option>
            <option v-for="option in DOWNLOAD_TARGET_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('toolsPage.shares.expires') }}</span>
          <input
            v-model.trim="shareForm.expiresHours"
            :class="{ 'is-invalid': expiresInvalid }"
            type="number"
            inputmode="numeric"
            min="0"
            :max="MAX_SHARE_HOURS"
            step="1"
          />
          <span v-if="expiresInvalid" class="field-hint is-error">{{ t('toolsPage.shares.expiresError', { max: MAX_SHARE_HOURS }) }}</span>
        </label>
        <div class="form-actions">
          <nut-button type="primary" native-type="submit" :loading="shareCreating" :disabled="!shareForm.resourceId">
            {{ t('toolsPage.shares.create') }}
          </nut-button>
        </div>
      </form>

      <div v-if="createdShareUrl" class="created-link">
        <div class="created-link-head">
          <strong>{{ t('toolsPage.shares.createdTitle') }}</strong>
          <span>{{ t('toolsPage.shares.createdHint') }}</span>
        </div>
        <div class="created-link-body">
          <code>{{ createdShareUrl }}</code>
          <nut-button type="primary" size="small" @click="copyText(createdShareUrl)">
            <font-awesome-icon icon="fa-solid fa-clone" />
            {{ t('toolsPage.shares.copy') }}
          </nut-button>
        </div>
      </div>

      <p v-if="shares.length === 0" class="empty">{{ t('toolsPage.shares.empty') }}</p>
      <div v-for="share in shares" :key="share.id" class="list-item">
        <div class="list-item-main">
          <strong>
            {{ resourceTypeLabel(share.resourceType) }} · {{ resourceName(share.resourceType, share.resourceId) }}
            <span class="badge" :class="share.enabled ? 'is-on' : 'is-off'">
              {{ share.enabled ? t('toolsPage.shares.enabled') : t('toolsPage.shares.disabled') }}
            </span>
          </strong>
          <small>
            {{ targetName(share.target) }} ·
            {{ share.expiresAt ? t('toolsPage.shares.expiresAt', { time: formatDateTime(share.expiresAt) }) : t('toolsPage.shares.never') }}
          </small>
        </div>
        <div class="actions">
          <nut-button plain size="mini" @click="toggleShare(share)">{{ share.enabled ? t('toolsPage.shares.disable') : t('toolsPage.shares.enable') }}</nut-button>
          <nut-button plain type="danger" size="mini" @click="removeShare(share.id)">{{ t('myPage.btn.delete') }}</nut-button>
        </div>
      </div>
    </section>

    <section class="tool-card">
      <h2>{{ t('toolsPage.recycle.title') }}</h2>
      <p>{{ t('toolsPage.recycle.desc') }}</p>
      <p v-if="recycleEntries.length === 0" class="empty">{{ t('toolsPage.recycle.empty') }}</p>
      <div v-for="entry in recycleEntries" :key="entry.id" class="list-item">
        <div class="list-item-main">
          <strong>{{ recycleTitle(entry) }}</strong>
          <small>{{ t('toolsPage.recycle.deletedAt', { time: formatDateTime(entry.deletedAt) }) }}</small>
        </div>
        <div class="actions">
          <nut-button plain type="primary" size="mini" @click="restoreEntry(entry.id)">{{ t('toolsPage.recycle.restore') }}</nut-button>
          <nut-button plain type="danger" size="mini" @click="purgeEntry(entry)">{{ t('toolsPage.recycle.purge') }}</nut-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { Dialog } from '@nutui/nutui';
import axios from 'axios';
import { storeToRefs } from 'pinia';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCloudflareApi } from '@/api/app';
import { DOWNLOAD_TARGET_OPTIONS, getTargetLabel } from '@/constants/subscriptionTargets';
import { useAppNotifyStore } from '@/store/appNotify';
import { useSubsStore } from '@/store/subs';
import { formatDateTime } from '@/utils/formatDateTime';

type ShareResourceType = 'source' | 'collection';
type RecycleResourceType = ShareResourceType | 'template' | 'share';

type Share = {
  id: string;
  resourceType: ShareResourceType;
  resourceId: string;
  target?: string;
  expiresAt?: number;
  enabled: boolean;
};

type RecycleEntry = {
  id: string;
  resourceType: RecycleResourceType;
  resourceId: string;
  snapshot: Record<string, unknown>;
  deletedAt: number;
};

// 与后端 /api/shares 的上限一致：365 天
const MAX_SHARE_HOURS = 365 * 24;

const { t } = useI18n();
const api = useCloudflareApi();
const { showNotify } = useAppNotifyStore();
const { subs, collections } = storeToRefs(useSubsStore());

const proxyTargets = DOWNLOAD_TARGET_OPTIONS.map((option) => option.value as string);
const ruleTargets = ['mihomo', 'surge', 'loon', 'qx'];
const conversionKind = ref<'proxy' | 'rule'>('proxy');
const conversionTarget = ref('mihomo');
const conversionInput = ref('');
const conversionOutput = ref('');
const conversionStats = ref('');
const converting = ref(false);
const shares = ref<Share[]>([]);
const recycleEntries = ref<RecycleEntry[]>([]);
const shareCreating = ref(false);
const createdShareUrl = ref('');
const shareForm = reactive({ resourceType: 'source' as ShareResourceType, resourceId: '', target: '', expiresHours: '0' });
const conversionTargets = computed(() => conversionKind.value === 'proxy' ? proxyTargets : ruleTargets);

// 订阅 store 里 name 是资源 ID，displayName 是展示名
const resourcesByType = computed(() => ({
  source: subs.value.map((item) => ({ id: item.name, label: item.displayName || item.name })),
  collection: collections.value.map((item) => ({ id: item.name, label: item.displayName || item.name })),
}));
const resourceOptions = computed(() => resourcesByType.value[shareForm.resourceType]);

// 类型切换或数据加载后，确保选中项属于当前类型
watch(resourceOptions, (options) => {
  if (!options.some((option) => option.id === shareForm.resourceId)) {
    shareForm.resourceId = options[0]?.id || '';
  }
}, { immediate: true });

const expiresHoursValue = computed(() => Number(shareForm.expiresHours === '' ? 0 : shareForm.expiresHours));
const expiresInvalid = computed(() => {
  const value = expiresHoursValue.value;
  return !Number.isInteger(value) || value < 0 || value > MAX_SHARE_HOURS;
});

const resourceTypeLabel = (type: string) => {
  return ['source', 'collection', 'template', 'share'].includes(type) ? t(`toolsPage.resourceTypes.${type}`) : type;
};
const resourceName = (type: string, id: string) => {
  const list = type === 'collection' ? resourcesByType.value.collection : type === 'source' ? resourcesByType.value.source : [];
  return list.find((item) => item.id === id)?.label || id;
};
const targetName = (target?: string) => target ? getTargetLabel(target) : t('toolsPage.shares.autoTarget');

const recycleTitle = (entry: RecycleEntry) => {
  const type = resourceTypeLabel(entry.resourceType);
  const snapshot = entry.snapshot || {};
  if (entry.resourceType === 'share') {
    const refType = String(snapshot.resourceType || '');
    const refId = String(snapshot.resourceId || '');
    const ref = refId ? `${resourceTypeLabel(refType)} · ${resourceName(refType, refId)}` : entry.resourceId;
    return `${type} · ${ref} · ${targetName(snapshot.target as string | undefined)}`;
  }
  const name = typeof snapshot.name === 'string' && snapshot.name ? snapshot.name : entry.resourceId;
  return `${type} · ${name}`;
};

// 请求错误已由 axios 拦截器提示，这里只提示其他异常
const notifyError = (error: unknown) => {
  if (axios.isAxiosError(error)) return;
  showNotify({ type: 'danger', title: t('toolsPage.notify.failed', { e: error instanceof Error ? error.message : String(error) }) });
};
const run = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    notifyError(error);
  }
};

const runConversion = async () => {
  converting.value = true;
  try {
    if (!conversionTargets.value.includes(conversionTarget.value)) conversionTarget.value = conversionTargets.value[0];
    const response = conversionKind.value === 'proxy'
      ? await api.convertProxies({ content: conversionInput.value, target: conversionTarget.value })
      : await api.convertRules({ content: conversionInput.value, target: conversionTarget.value });
    const data = (response?.data as any)?.data;
    conversionOutput.value = String(data?.content || data?.par_res || '');
    conversionStats.value = t('toolsPage.converter.stats', {
      parsed: data?.parsed || 0,
      emitted: data?.emitted || 0,
      skipped: data?.skipped || 0,
    });
    showNotify({ type: 'success', title: t('toolsPage.notify.converted') });
  } catch (error) {
    notifyError(error);
  } finally {
    converting.value = false;
  }
};

const loadShares = async () => {
  const response = await api.getShares();
  const data = (response?.data as any)?.data;
  shares.value = Array.isArray(data) ? data : [];
};
const loadRecycle = async () => {
  const response = await api.getRecycleBin();
  const data = (response?.data as any)?.data;
  recycleEntries.value = Array.isArray(data) ? data : [];
};
const createShare = async () => {
  if (!shareForm.resourceId || expiresInvalid.value) return;
  shareCreating.value = true;
  try {
    const response = await api.createShare({
      resourceType: shareForm.resourceType,
      resourceId: shareForm.resourceId,
      target: shareForm.target || undefined,
      expiresIn: expiresHoursValue.value * 3600,
    });
    createdShareUrl.value = String((response?.data as any)?.data?.url || '');
    await loadShares();
    showNotify({ type: 'success', title: t('toolsPage.notify.shareCreated') });
  } catch (error) {
    notifyError(error);
  } finally {
    shareCreating.value = false;
  }
};
const toggleShare = (share: Share) => run(async () => {
  await api.updateShare(share.id, { enabled: !share.enabled });
  await loadShares();
});
const removeShare = (id: string) => run(async () => {
  await api.deleteShare(id);
  await Promise.all([loadShares(), loadRecycle()]);
});
const restoreEntry = (id: string) => run(async () => {
  await api.restoreRecycleEntry(id);
  // 恢复的订阅源/组合/分享需要同步到列表
  await Promise.all([loadRecycle(), loadShares(), useSubsStore().fetchSubsData()]);
  showNotify({ type: 'success', title: t('toolsPage.notify.restored') });
});
const purgeEntry = (entry: RecycleEntry) => {
  Dialog({
    title: t('toolsPage.recycle.purgeTitle'),
    content: t('toolsPage.recycle.purgeContent', { name: recycleTitle(entry) }),
    popClass: 'auto-dialog',
    okText: t('toolsPage.recycle.purge'),
    cancelText: t('myPage.btn.cancel'),
    closeOnClickOverlay: true,
    onOk: () => run(async () => {
      await api.deleteRecycleEntry(entry.id);
      await loadRecycle();
    }),
  });
};
const copyText = (value: string) => run(async () => {
  await navigator.clipboard.writeText(value);
  showNotify({ type: 'success', title: t('toolsPage.notify.copied') });
});

onMounted(() => run(() => Promise.all([loadShares(), loadRecycle()])));
</script>

<style lang="scss" scoped>
.tools-page { min-height: 100%; padding: var(--safe-area-side); display: flex; flex-direction: column; gap: 10px; }
.tool-card { padding: 16px; border-radius: var(--item-card-radios); background: var(--card-color); color: var(--second-text-color); }
h2 { margin: 0; color: var(--primary-text-color); font-size: 16px; }
p { color: var(--comment-text-color); font-size: 12px; line-height: 1.6; }
.row { display: flex; gap: 8px; margin-bottom: 8px; }
select, input, textarea { box-sizing: border-box; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--background-color); color: var(--primary-text-color); }
select, input { min-height: 38px; padding: 0 10px; }
input.is-invalid { border-color: var(--danger-color); }
textarea { width: 100%; min-height: 150px; padding: 10px; resize: vertical; font-family: monospace; }
.actions { display: flex; gap: 8px; margin: 8px 0; }
.share-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin-bottom: 8px; }
.field { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.field select, .field input { width: 100%; }
.field-label { color: var(--primary-text-color); font-size: 13px; }
.field-hint { font-size: 12px; }
.field-hint.is-error { color: var(--danger-color); }
.form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
.form-actions .nut-button { margin-right: 0; }
.created-link { margin: 12px 0; padding: 12px; border: 1px solid var(--primary-color); border-radius: 10px; background: var(--background-color); }
.created-link-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 8px; }
.created-link-head strong { color: var(--primary-text-color); font-size: 14px; }
.created-link-head span { color: var(--comment-text-color); font-size: 12px; }
.created-link-body { display: flex; align-items: center; gap: 10px; }
.created-link-body code { flex: 1; min-width: 0; color: var(--primary-text-color); font-size: 12px; overflow-wrap: anywhere; user-select: all; }
.created-link-body .nut-button { flex-shrink: 0; margin-right: 0; }
.created-link-body svg { margin-right: 4px; }
.list-item { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--divider-color); }
.list-item-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.list-item strong { color: var(--primary-text-color); font-size: 13px; overflow-wrap: anywhere; }
.list-item small, .stats, .empty { color: var(--comment-text-color); }
.badge { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 18px; vertical-align: 1px; }
.badge.is-on { color: var(--primary-color); border: 1px solid var(--primary-color); }
.badge.is-off { color: var(--comment-text-color); border: 1px solid var(--divider-color); }
@media (max-width: 520px) {
  .row { flex-direction: column; }
  .share-form { grid-template-columns: minmax(0, 1fr); }
  .created-link-body { flex-direction: column; align-items: stretch; }
  .list-item { align-items: flex-start; flex-direction: column; padding: 10px 0; }
}
</style>
