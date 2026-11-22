<template>
  <div class="my-page-wrapper">
    <section class="profile-block">
      <div class="radio-wrapper">
        <span class="tag current">{{ env.runtime || "Cloudflare Workers" }}</span>
        <div class="storage-language-switch">
          <LanguageSwitcherButton />
        </div>
      </div>
      <div class="info">
        <div class="avatar-wrapper">
          <nut-avatar
            size="72"
            bg-color="var(--card-color)"
            :url="logoIcon"
          />
          <div class="name">
            <p class="title">{{ appName }}</p>
            <p class="des">
              <span class="des-line1">{{ t("myPage.profile.desc") }}</span>
              <span class="des-line2">{{ env.storage || "D1" }} · v{{ env.version || "-" }}</span>
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="config-card storage-card">
      <div class="title-wrapper">
        <h1>{{ t("myPage.backup.title") }}</h1>
      </div>
      <p class="card-desc">{{ t("myPage.backup.desc") }}</p>
      <div class="card-actions">
        <input ref="fileInput" type="file" accept="application/json,.json" @change="restoreFromFile" />
        <nut-button plain type="primary" size="small" :loading="restoreIsLoading" @click="selectBackupFile">
          <font-awesome-icon v-if="!restoreIsLoading" icon="fa-solid fa-cloud-arrow-up" />
          {{ t("myPage.backup.restore") }}
        </nut-button>
        <nut-button type="primary" size="small" :loading="exportIsLoading" @click="exportBackup">
          <font-awesome-icon v-if="!exportIsLoading" icon="fa-solid fa-cloud-arrow-down" />
          {{ t("myPage.backup.export") }}
        </nut-button>
      </div>
    </section>

    <section class="config-card storage-card">
      <div class="title-wrapper">
        <h1>{{ t("myPage.session.title") }}</h1>
        <div class="storage-actions">
          <nut-button plain type="danger" size="small" @click="confirmLogout">
            <font-awesome-icon icon="fa-solid fa-right-from-bracket" />
            {{ t("myPage.session.logout") }}
          </nut-button>
        </div>
      </div>
      <p class="card-desc">{{ t("myPage.session.desc") }}</p>
    </section>

    <section class="config-card">
      <div class="title-wrapper">
        <h1>{{ t("myPage.templates.title") }}</h1>
        <div class="storage-actions">
          <input ref="templateFileInput" type="file" accept="application/json,.json,.yaml,.yml,text/yaml" @change="importTemplateFromFile" />
          <nut-button plain type="primary" size="small" :loading="templateImporting" @click="selectTemplateFile">
            <font-awesome-icon v-if="!templateImporting" icon="fa-solid fa-file-import" />
            {{ t("myPage.templates.importFile") }}
          </nut-button>
          <nut-button type="primary" size="small" :loading="templateImporting" @click="openTemplateImport">
            <font-awesome-icon v-if="!templateImporting" icon="fa-solid fa-plus" />
            {{ t("myPage.templates.create") }}
          </nut-button>
        </div>
      </div>
      <div class="template-list">
        <div v-for="template in templates" :key="template.name" class="template-item">
          <div class="template-text">
            <span class="template-title">{{ template.displayName || template.name }}</span>
            <span class="template-meta">
              {{ template.readonly ? t("myPage.templates.builtIn") : t("myPage.templates.custom") }}
              · {{ getTargetLabel(template.target || "mihomo") }}
            </span>
          </div>
          <div class="template-actions">
            <nut-button v-if="!template.readonly" plain type="primary" size="mini" @click="openTemplateEdit(template)">
              {{ t("myPage.btn.edit") }}
            </nut-button>
            <nut-button v-if="!template.readonly" plain type="danger" size="mini" @click="deleteCustomTemplate(template.name)">
              {{ t("myPage.btn.delete") }}
            </nut-button>
          </div>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="title-wrapper">
        <h1>{{ t("myPage.request.title") }}</h1>
      </div>
      <p class="card-desc">{{ t("myPage.request.desc") }}</p>
      <form class="request-form" novalidate @submit.prevent="saveRequestSettings">
        <label v-for="field in numberFields" :key="field.key" class="field">
          <span class="field-label">{{ t(`myPage.request.${field.key}`) }}</span>
          <input
            v-model.trim="requestForm[field.key]"
            class="field-input"
            :class="{ 'is-invalid': requestErrors[field.key] }"
            type="number"
            inputmode="numeric"
            :min="field.min"
            :max="field.max"
            step="1"
            :placeholder="field.optional ? t('myPage.request.unlimited') : ''"
          />
          <span class="field-hint" :class="{ 'is-error': requestErrors[field.key] }">
            {{ requestErrors[field.key] || fieldHint(field) }}
          </span>
        </label>
        <label v-for="field in textFields" :key="field.key" class="field">
          <span class="field-label">{{ t(`myPage.request.${field.key}`) }}</span>
          <input
            v-model.trim="requestForm[field.key]"
            class="field-input"
            :class="{ 'is-invalid': requestErrors[field.key] }"
            type="text"
            autocomplete="off"
            spellcheck="false"
          />
          <span v-if="requestErrors[field.key]" class="field-hint is-error">{{ requestErrors[field.key] }}</span>
        </label>
        <div class="field switch-field">
          <span class="field-label">{{ t("myPage.request.remoteCacheStaleOnError") }}</span>
          <nut-switch v-model="requestForm.remoteCacheStaleOnError" />
        </div>
        <div class="form-actions">
          <nut-button plain type="info" size="small" :disabled="requestSaving" @click="syncRequestForm">
            <font-awesome-icon icon="fa-solid fa-ban" />
            {{ t("myPage.btn.reset") }}
          </nut-button>
          <nut-button type="primary" size="small" :loading="requestSaving" native-type="submit">
            <font-awesome-icon v-if="!requestSaving" icon="fa-solid fa-floppy-disk" />
            {{ t("myPage.btn.save") }}
          </nut-button>
        </div>
      </form>
    </section>

    <nut-popup v-model:visible="templateImportVisible" position="bottom" round closeable :style="{ height: '82vh' }">
      <div class="template-import-panel">
        <h2>{{ templateEditingId ? t("myPage.templates.editTitle") : t("myPage.templates.importTitle") }}</h2>
        <nut-input class="input" v-model.trim="templateForm.id" :placeholder="t('myPage.templates.idPlaceholder')" input-align="left" :disabled="Boolean(templateEditingId)" />
        <nut-input class="input" v-model.trim="templateForm.name" :placeholder="t('myPage.templates.namePlaceholder')" input-align="left" />
        <nut-cell class="template-target-trigger" @click="openTemplateTargetPicker">
          <view class="nut-cell__title">{{ t("myPage.templates.target") }}</view>
          <view class="nut-cell__value">
            <nut-input
              :model-value="templateTargetLabel"
              :border="false"
              readonly
              input-align="right"
              right-icon="rect-right"
              @click-right-icon.stop="openTemplateTargetPicker"
            />
          </view>
        </nut-cell>
        <div class="template-content-editor">
          <CmView v-if="templateImportVisible" :is-read-only="false" id="TemplateEditor" />
        </div>
        <nut-button block type="primary" :loading="templateImporting" @click="saveTemplate">
          {{ t("myPage.templates.save") }}
        </nut-button>
      </div>
    </nut-popup>
    <DesktopPicker
      v-model="selectedTemplateTargetValue"
      v-model:visible="templateTargetPickerVisible"
      :columns="templateTargetColumns"
      :title="t('myPage.templates.targetPickerTitle')"
      :cancel-text="t('myPage.btn.cancel')"
      :ok-text="t('specificWord.confirm')"
      @confirm="handleTemplateTargetConfirm"
    />
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from "vue";
import { Dialog } from "@nutui/nutui";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { useCloudflareApi } from "@/api/app";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton.vue";
import DesktopPicker from "@/components/DesktopPicker.vue";
import { useSettingsApi } from "@/api/settings";
import logoIcon from "@/assets/icons/logo.svg?url";
import { useAppNotifyStore } from "@/store/appNotify";
import { useCodeStore } from "@/store/codeStore";
import { useGlobalStore } from "@/store/global";
import { useSettingsStore } from "@/store/settings";
import { resetToTokenEntry } from "@/utils/session";
import { TEMPLATE_TARGET_OPTIONS, getTargetLabel } from "@/constants/subscriptionTargets";

const CmView = defineAsyncComponent(() => import("@/views/editCode/cmView.vue"));

const settingsStore = useSettingsStore();
const settingsApi = useSettingsApi();
const cloudflareApi = useCloudflareApi();
const cmStore = useCodeStore();
const { showNotify } = useAppNotifyStore();
const { t } = useI18n();
const router = useRouter();
const { env } = storeToRefs(useGlobalStore());
const TEMPLATE_EDITOR_ID = "TemplateEditor";

const fileInput = ref<HTMLInputElement | null>(null);
const templateFileInput = ref<HTMLInputElement | null>(null);
const restoreIsLoading = ref(false);
const exportIsLoading = ref(false);
const requestSaving = ref(false);
const templateImporting = ref(false);
const templateImportVisible = ref(false);
const templateEditingId = ref("");
const templateTargetPickerVisible = ref(false);
const templates = ref<any[]>([]);

type RequestNumberKey =
  | "backendRequestConcurrency"
  | "backendRequestConcurrencyWaitTime"
  | "defaultTimeout"
  | "remoteCacheTtl"
  | "subrequestLimit";
type RequestTextKey = "defaultUserAgent" | "defaultFlowUserAgent" | "nodeInfoApiUrl";
type RequestNumberField = { key: RequestNumberKey; min: number; max: number; optional?: boolean };

// 范围与后端 /api/settings 及请求逻辑的校验保持一致
const numberFields: RequestNumberField[] = [
  { key: "backendRequestConcurrency", min: 1, max: 6 },
  { key: "defaultTimeout", min: 1000, max: 120000 },
  { key: "remoteCacheTtl", min: 0, max: 3600 },
  { key: "subrequestLimit", min: 10, max: 1000, optional: true },
  { key: "backendRequestConcurrencyWaitTime", min: 0, max: 5000 },
];
const textFields: { key: RequestTextKey }[] = [
  { key: "defaultUserAgent" },
  { key: "defaultFlowUserAgent" },
  { key: "nodeInfoApiUrl" },
];

const requestForm = reactive({
  defaultUserAgent: "",
  defaultFlowUserAgent: "",
  defaultTimeout: "",
  backendRequestConcurrency: "",
  backendRequestConcurrencyWaitTime: "",
  remoteCacheTtl: "",
  remoteCacheStaleOnError: true,
  subrequestLimit: "",
  nodeInfoApiUrl: "",
});
const requestErrors = reactive<Partial<Record<RequestNumberKey | RequestTextKey, string>>>({});
const templateForm = reactive({
  id: "",
  name: "",
  target: "mihomo",
});
const selectedTemplateTargetValue = ref<string[]>([]);
const templateTargetColumns = computed(() => {
  return TEMPLATE_TARGET_OPTIONS.map((option) => ({
    text: option.label,
    value: option.value,
  }));
});
const templateTargetLabel = computed(() => {
  return getTargetLabel(templateForm.target);
});
const appName = computed(() => env.value?.app || "Sub-Store Cloudflare");
const fieldHint = (field: RequestNumberField) => {
  return t("myPage.request.rangeHint", { min: field.min, max: field.max });
};

const syncRequestForm = () => {
  requestForm.defaultUserAgent = settingsStore.defaultUserAgent || "";
  requestForm.defaultFlowUserAgent = settingsStore.defaultFlowUserAgent || "";
  requestForm.defaultTimeout = settingsStore.defaultTimeout || "30000";
  requestForm.backendRequestConcurrency = settingsStore.backendRequestConcurrency || "3";
  requestForm.backendRequestConcurrencyWaitTime = settingsStore.backendRequestConcurrencyWaitTime || "0";
  requestForm.remoteCacheTtl = settingsStore.remoteCacheTtl || "300";
  requestForm.remoteCacheStaleOnError = settingsStore.remoteCacheStaleOnError !== false;
  requestForm.subrequestLimit = settingsStore.subrequestLimit || "";
  requestForm.nodeInfoApiUrl = settingsStore.nodeInfoApiUrl || "https://ipwho.is/{ip}";
  Object.keys(requestErrors).forEach((key) => delete requestErrors[key]);
};

const validateRequestForm = () => {
  Object.keys(requestErrors).forEach((key) => delete requestErrors[key]);

  for (const field of numberFields) {
    const raw = String(requestForm[field.key] ?? "").trim();
    if (field.optional && raw === "") continue;
    const value = Number(raw);
    if (raw === "" || !Number.isInteger(value) || value < field.min || value > field.max) {
      requestErrors[field.key] = t("myPage.request.rangeError", { min: field.min, max: field.max });
    }
  }

  const nodeInfoApiUrl = requestForm.nodeInfoApiUrl.trim();
  if (!nodeInfoApiUrl.startsWith("https://") || !nodeInfoApiUrl.includes("{ip}")) {
    requestErrors.nodeInfoApiUrl = t("myPage.request.nodeInfoApiUrlError");
  }
  if (!requestForm.defaultUserAgent.trim()) {
    requestErrors.defaultUserAgent = t("myPage.request.required");
  }
  if (!requestForm.defaultFlowUserAgent.trim()) {
    requestErrors.defaultFlowUserAgent = t("myPage.request.required");
  }

  return Object.keys(requestErrors).length === 0;
};

const saveRequestSettings = async () => {
  if (!validateRequestForm()) {
    showNotify({ type: "danger", title: t("myPage.request.invalid") });
    return;
  }

  requestSaving.value = true;
  try {
    const saved = await settingsStore.changeSettings({
      ...requestForm,
      // 空字符串表示不限制子请求数量
      subrequestLimit: String(requestForm.subrequestLimit).trim(),
    });
    // 保存失败时保留用户已填内容
    if (saved) syncRequestForm();
  } catch {
    // 请求错误已由 axios 拦截器提示
  } finally {
    requestSaving.value = false;
  }
};

const confirmLogout = () => {
  Dialog({
    title: t("myPage.session.confirmTitle"),
    content: t("myPage.session.confirmContent"),
    popClass: "auto-dialog",
    okText: t("myPage.session.logout"),
    cancelText: t("myPage.btn.cancel"),
    closeOnClickOverlay: true,
    onOk: async () => {
      await resetToTokenEntry(router);
    },
  });
};

const selectBackupFile = () => {
  fileInput.value?.click();
};

const exportBackup = async () => {
  exportIsLoading.value = true;
  try {
    const response = await settingsApi.downloadBackup();
    const objectUrl = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `sub-store-cloudflare-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    showNotify({ type: "danger", title: t("myPage.notify.backup.failedWithError", { e: errorMessage(error) }) });
  } finally {
    exportIsLoading.value = false;
  }
};

const fetchTemplates = async () => {
  const res = await cloudflareApi.getTemplates();
  if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
    templates.value = res.data.data;
  }
};

const selectTemplateFile = () => {
  templateFileInput.value?.click();
};

const openTemplateImport = () => {
  templateEditingId.value = "";
  templateForm.id = "";
  templateForm.name = "";
  templateForm.target = "mihomo";
  cmStore.setEditCode(TEMPLATE_EDITOR_ID, "");
  templateImportVisible.value = true;
};

const openTemplateEdit = (template: any) => {
  templateEditingId.value = template.name;
  templateForm.id = template.name;
  templateForm.name = template.displayName || template.name;
  templateForm.target = template.target || "mihomo";
  cmStore.setEditCode(TEMPLATE_EDITOR_ID, JSON.stringify(template.config || {}, null, 2));
  templateImportVisible.value = true;
};

const importTemplateFromFile = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  templateEditingId.value = "";
  templateForm.id = file.name.replace(/\.(json|ya?ml)$/i, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  templateForm.name = file.name.replace(/\.(json|ya?ml)$/i, "");
  templateForm.target = "mihomo";
  cmStore.setEditCode(TEMPLATE_EDITOR_ID, await file.text());
  templateImportVisible.value = true;
};

const openTemplateTargetPicker = () => {
  selectedTemplateTargetValue.value = [templateForm.target || "mihomo"];
  templateTargetPickerVisible.value = true;
};

const handleTemplateTargetConfirm = ({ selectedValue }) => {
  templateForm.target = selectedValue?.[0] || "mihomo";
  selectedTemplateTargetValue.value = [templateForm.target];
  templateTargetPickerVisible.value = false;
};

const saveTemplate = async () => {
  const content = String(cmStore.EditCode[TEMPLATE_EDITOR_ID] || "");
  if (!templateForm.id || !content.trim()) {
    showNotify({ type: "danger", title: t("myPage.templates.validationRequired") });
    return;
  }

  templateImporting.value = true;
  try {
    const payload = {
      id: templateForm.id,
      name: templateForm.name || templateForm.id,
      target: templateForm.target,
      content,
    };
    const res = templateEditingId.value
      ? await cloudflareApi.updateTemplate(templateEditingId.value, payload)
      : await cloudflareApi.createTemplate(payload);
    if (res?.data?.status !== "success") throw new Error("import failed");
    await fetchTemplates();
    templateImportVisible.value = false;
    templateEditingId.value = "";
    showNotify({ type: "success", title: t("myPage.templates.saveSucceed") });
  } catch (error) {
    showNotify({ type: "danger", title: t("myPage.templates.saveFailed", { e: errorMessage(error) }) });
  } finally {
    templateImporting.value = false;
  }
};

const deleteCustomTemplate = (name: string) => {
  Dialog({
    title: t("myPage.templates.deleteTitle"),
    content: t("myPage.templates.deleteContent", { name }),
    popClass: "auto-dialog",
    okText: t("myPage.btn.delete"),
    cancelText: t("myPage.btn.cancel"),
    closeOnClickOverlay: true,
    onOk: async () => {
      const res = await cloudflareApi.deleteTemplate(name);
      if (res?.data?.status === "success") {
        await fetchTemplates();
        showNotify({ type: "success", title: t("myPage.templates.deleteSucceed") });
      }
    },
  });
};

const restoreFromFile = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  Dialog({
    title: t("myPage.backup.restoreTitle"),
    content: t("myPage.backup.restoreContent"),
    popClass: "auto-dialog",
    okText: t("myPage.backup.restore"),
    cancelText: t("myPage.btn.cancel"),
    closeOnClickOverlay: true,
    onOk: async () => {
      restoreIsLoading.value = true;
      try {
        const content = await file.text();
        const res = await settingsApi.restoreSettings({ content });
        if (res?.data?.status !== "success") throw new Error("restore failed");
        await settingsStore.fetchSettings();
        showNotify({ type: "success", title: t("myPage.notify.restore.succeed") });
      } catch (error) {
        showNotify({ type: "danger", title: t("myPage.notify.restore.failedWithError", { e: errorMessage(error) }) });
      } finally {
        restoreIsLoading.value = false;
      }
    },
  });
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

// 直接打开设置页时，设置可能还没加载完，加载完成后再填充表单
watch(() => settingsStore.hasFetchedSettings, syncRequestForm);

onMounted(() => {
  syncRequestForm();
  fetchTemplates();
});
</script>

<style lang="scss" scoped>
.my-page-wrapper {
  min-height: 100%;
  padding: var(--safe-area-side);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.profile-block {
  width: 100%;

  .radio-wrapper {
    display: flex;
    align-items: center;

    .tag {
      margin: 0 5px;
      padding: 7.5px 2.5px 4px;
      flex-shrink: 0;
      color: var(--second-text-color);
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    }

    .current {
      border-bottom: 1px solid var(--primary-color);
      color: var(--primary-color);
    }

    .storage-language-switch {
      margin-left: auto;
      flex-shrink: 0;
    }
  }

  .info {
    width: 100%;
    margin-bottom: 10px;
    padding: 12px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .avatar-wrapper {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;

    :deep(.nut-avatar) {
      background: var(--card-color);
    }
  }

  .name {
    min-width: 0;
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    font-size: 18px;
    font-weight: bold;
  }

  .title {
    margin: 0;
    overflow: hidden;
    color: var(--primary-text-color);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .des {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    color: var(--comment-text-color);
    font-size: 12px;
    font-weight: normal;
    line-height: 1.45;
  }

}

.config-card {
  width: 100%;
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  color: var(--second-text-color);
  overflow: hidden;
}

.nut-icon {
  color: var(--lowest-text-color);
}

.template-list {
  display: flex;
  flex-direction: column;
}

.template-item {
  min-height: 54px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--divider-color);

  &:last-child {
    border-bottom: 0;
  }
}

.template-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-title,
.template-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-title {
  font-size: 14px;
  color: var(--primary-text-color);
}

.template-meta {
  font-size: 12px;
  color: var(--comment-text-color);
}

.template-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.template-import-panel {
  height: 100%;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--second-text-color);

  h2 {
    margin: 0 0 4px;
    font-size: 17px;
    color: var(--primary-text-color);
  }
}

.template-target-trigger {
  box-shadow: none;
  border-radius: var(--item-card-radios);
  background: var(--background-color);
}

.template-content-editor {
  flex: 1;
  min-height: 220px;
  border: 1px solid var(--divider-color);
  border-radius: var(--item-card-radios);
  background: var(--background-color);
  overflow: auto;

  :deep(.cmviewRef) {
    min-height: 220px;
  }

  :deep(.cm-editor) {
    min-height: 220px;
  }
}

.title-wrapper {
  min-height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--divider-color);

  h1 {
    margin: 0;
    font-size: 15px;
    color: var(--primary-text-color);
  }
}

.storage-actions {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    display: none;
  }
}

.card-desc {
  margin: 0;
  padding: 12px 16px 16px;
  color: var(--comment-text-color);
  font-size: 12px;
  line-height: 1.6;
}

.card-actions {
  padding: 0 16px 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    display: none;
  }

  svg {
    margin-right: 4px;
  }

  .nut-button--plain {
    background: transparent;
  }
}

.request-form {
  padding: 0 16px 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;

  .field {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    color: var(--primary-text-color);
    font-size: 13px;
  }

  .field-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    background: var(--background-color);
    color: var(--primary-text-color);
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    &.is-invalid {
      border-color: var(--danger-color);
    }
  }

  .field-hint {
    color: var(--comment-text-color);
    font-size: 12px;
    line-height: 1.4;

    &.is-error {
      color: var(--danger-color);
    }
  }

  .switch-field {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .form-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    svg {
      margin-right: 4px;
    }

    .nut-button--plain {
      background: transparent;
    }
  }
}

@media screen and (max-width: 430px) {
  .title-wrapper {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px;
  }

  .storage-actions {
    flex-wrap: wrap;
  }

  .request-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .template-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .template-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
