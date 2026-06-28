<template>
  <div class="editor-action-card">
    <p class="des-label">
      {{ $t(`editorPage.subConfig.nodeActions['${type}'].des`) }}
    </p>
    <div class="radio-wrapper options-radio">
      <nut-radiogroup direction="horizontal" v-model="value">
        <nut-radio v-for="(key, index) in opt[type]" :label="key" :key="index"
          >
          <div
            class="input-wrapper compact-input-wrapper compact-input-wrapper--custom"
            v-if="type === 'Resolve Domain Operator' && value==='Custom' && key==='Custom'"
          >
            <nut-input :placeholder="$t(`editorPage.subConfig.nodeActions['${type}'].customDohPlaceholder`)" v-model="rdoUrl" />
          </div>
          <div v-else>
            {{
            $t(`editorPage.subConfig.nodeActions['${type}'].options[${index}]`)
          }}
          </div>
        </nut-radio>
      </nut-radiogroup>
    </div>
    <template v-if="type === 'Resolve Domain Operator' && rdoNewVersion">
      <div class="radio-wrapper options-radio edns-input-option">
        <p class="des-label">{{ $t(`editorPage.subConfig.nodeActions['${type}'].edns`) }}</p>
        <div class="input-wrapper compact-input-wrapper compact-input-wrapper--edns">
          <nut-input :placeholder="$t(`editorPage.subConfig.nodeActions['${type}'].ednsPlaceholder`)" v-model="rdoEdns" />
        </div>
      </div>
      <div class="radio-wrapper options-radio inline-input-option">
        <p class="des-label">{{ $t(`editorPage.subConfig.nodeActions['${type}'].concurrency`) }}</p>
        <div class="input-wrapper compact-input-wrapper compact-input-wrapper--concurrency">
          <nut-input
            type="number"
            :placeholder="$t(`editorPage.subConfig.nodeActions['${type}'].concurrencyPlaceholder`)"
            v-model="rdoConcurrency"
          />
        </div>
      </div>
      <div class="radio-wrapper options-radio">
        <p class="des-label" style="cursor: pointer" @click="rdoTypeInfo">{{ $t(`editorPage.subConfig.nodeActions['${type}'].resolveType`) }} <font-awesome-icon icon="fa-solid fa-circle-question"/></p>
        <nut-radiogroup direction="horizontal" v-model="rdoType">
          <nut-radio v-for="(key, index) in rdoTypeOpt" :label="key" :key="index"
            >{{
              $t(`editorPage.subConfig.nodeActions['${type}'].types[${index}]`)
            }}
            <!-- <font-awesome-icon v-if="key === 'IPv6'" @click="rdoTypeInfo" icon="fa-solid fa-circle-question"/> -->
          </nut-radio>
        </nut-radiogroup>
      </div>
      
      <div class="radio-wrapper options-radio">
        <p class="des-label">{{ $t(`editorPage.subConfig.nodeActions['${type}'].filterResult`) }}</p>
        <nut-radiogroup direction="horizontal" v-model="rdoFilter">
          <nut-radio v-for="(key, index) in rdoFilterOpt" :label="key" :key="index"
            >{{
              $t(`editorPage.subConfig.nodeActions['${type}'].filters[${index}]`)
            }}
          </nut-radio>
        </nut-radiogroup>
      </div>
    </template>
    <template v-if="type === 'Flag Operator' && foNewVersion && value === 'add'">
      <div class="radio-wrapper options-radio">
        <p class="des-label flag-operator" @click="showTwTips">
            <span>{{ $t(`editorPage.subConfig.nodeActions['${type}'].twWhenPrefix`) }}</span>
            <img :src="tw" alt="">
            <span>{{ $t(`editorPage.subConfig.nodeActions['${type}'].twWhenSuffix`) }}</span>
            <nut-icon name="tips" size="12px"></nut-icon>
        </p>
        <nut-radiogroup direction="horizontal" v-model="foTw">
          <nut-radio v-for="(key, index) in foTwOpt" :label="key" :key="index"
            >{{
              $t(`editorPage.subConfig.nodeActions['${type}'].twOptions[${index}]`)
            }}
          </nut-radio>
        </nut-radiogroup>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
  import { Toast, Dialog } from "@nutui/nutui";
  import { inject, onMounted, ref, watch } from 'vue';
  import tw from '@/assets/icons/tw.png';
  import { useI18n } from 'vue-i18n';

  const { t } = useI18n();

  const { type, id } = defineProps<{
    type: string;
    id: string;
  }>();

  const form = inject<Sub | Collection>('form');

  // 此处 key 需要与 i18n 的 actions 中的 key 相同
  // 值的次序需要与该选项的 options 值 顺序相同
  const opt = {
    'Flag Operator': ['add', 'remove'],
    'Sort Operator': ['asc', 'desc', 'random'],
    'Resolve Domain Operator': ['Google', 'Cloudflare', 'Ali', 'Tencent', 'Custom'],
  };
  const supportedResolveProviders = opt['Resolve Domain Operator'];
  const normalizeResolveProvider = (provider) =>
    supportedResolveProviders.includes(provider) ? provider : 'Cloudflare';

  const foTwOpt = ['cn', 'ws', 'tw'];
  const rdoTypeOpt = ['IPv4', 'IPv6'];
  const rdoFilterOpt = ['disabled', 'removeFailed', 'IPOnly', 'IPv4Only', 'IPv6Only'];

  const value = ref();
  const rdoNewVersion = ref(true);
  const foNewVersion = ref(true);

  const foTw = ref('cn');
  const rdoType = ref('IPv4');
  const rdoFilter = ref('disabled');
  const rdoCache = ref('disabled');
  const rdoUrl = ref('');
  const rdoEdns = ref('');
  const rdoConcurrency = ref('');

  const normalizeRdoConcurrency = () => {
    const value = `${rdoConcurrency.value ?? ''}`.trim();
    return value || undefined;
  };

  const getInitialRdoConcurrency = (value) => {
    return `${value ?? ''}`.trim();
  };

  const showTwTips = () => {
    Toast.text(t("editorPage.subConfig.nodeActions['Flag Operator'].disclaimer"));
  };
  const rdoTypeInfo = () => {
    Dialog({
      title: t("editorPage.subConfig.nodeActions['Resolve Domain Operator'].ip4pTitle"),
      content: t("editorPage.subConfig.nodeActions['Resolve Domain Operator'].ip4pContent"),
      popClass: 'auto-dialog',
      okText: t("editorPage.subConfig.nodeActions['Resolve Domain Operator'].ip4pOk"),
      cancelText: t("editorPage.subConfig.pop.deleteCancel"),
      // @ts-ignore
      closeOnClickOverlay: true,
      onOk: async () => {
        window.open('https://github.com/heiher/natmap/wiki/faq#%E5%9F%9F%E5%90%8D%E8%AE%BF%E9%97%AE%E6%98%AF%E5%A6%82%E4%BD%95%E5%AE%9E%E7%8E%B0%E7%9A%84')
      },
      // onCancel: async () => {
        
      // },
      closeOnPopstate: true,
      lockScroll: false,
    });
  };

  // 挂载时读取当前数据，赋值初始状态
  onMounted(() => {
    const item = form.process.find(item => item.id === id);

    if (item) {
      switch (type) {
        case 'Flag Operator':
          value.value = item.args?.mode ?? 'add';
          foTw.value = item.args?.tw ?? 'cn';
          break;
        case 'Sort Operator':
          value.value = item.args ?? 'asc';
          break;
        case 'Resolve Domain Operator':
          value.value = normalizeResolveProvider(item.args?.provider ?? 'Google');
          rdoType.value = item.args?.type ?? 'IPv4';
          if (rdoType.value === 'IP4P') {
            rdoType.value = 'IPv6';
          }
          rdoFilter.value = item.args?.filter ?? 'disabled';
          rdoCache.value = item.args?.cache ?? 'enabled';
          rdoUrl.value = item.args?.url ?? '';
          rdoEdns.value = item.args?.edns;
          rdoConcurrency.value = getInitialRdoConcurrency(item.args?.concurrency);
          break;
      }
    }
  });

  // 值变化时实时修改 form 的数据
  watch([value, rdoFilter, rdoCache, rdoUrl, rdoEdns, rdoConcurrency, rdoType, foTw], () => {
    const item = form.process.find(item => item.id === id);
    switch (type) {
      case 'Flag Operator':
        item.args = {
          mode: value.value,
          tw: foTw.value,
        };
        break;
      case 'Sort Operator':
        item.args = value.value;
        break;
      case 'Resolve Domain Operator':
        item.args = {
          provider: value.value,
          type: rdoType.value,
          filter: rdoFilter.value,
          cache: rdoCache.value,
          url: rdoUrl.value,
          edns: rdoEdns.value,
          concurrency: normalizeRdoConcurrency(),
        };
        break;
    }
  });
  
</script>

<style lang="scss" scoped>
  .des-label {
    font-size: 12px;
    margin-bottom: 8px;
    color: var(--comment-text-color);
    &.flag-operator {
      display: flex;
      align-items: center;
      cursor: pointer;
      img {
        width: 14px;
        height: 14px;
      }
      span {
        margin: 0 4px;
      }
    }
  }

  .nut-radiogroup {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .input-wrapper {
    display: flex;
    align-items: center;

    > view.nut-input {
      background: transparent;
      padding: 8px 12px;
      margin-right: 16px;
      border-bottom: 1px solid var(--lowest-text-color);
      color: var(--second-text-color);
    }
  }
  .compact-input-wrapper {
    > view.nut-input {
      min-height: 26px;
      height: 26px;
      padding: 2px 8px;
      margin-right: 0;
      font-size: 12px;
      line-height: 18px;
    }

    :deep(.nut-input) {
      min-height: 26px;
      height: 26px;
      padding: 2px 8px;
      font-size: 12px;
      line-height: 18px;
    }

    :deep(.nut-input-inner),
    :deep(.nut-input-value),
    :deep(.nut-input-box),
    :deep(.nut-input-text),
    :deep(input) {
      min-height: 20px;
      height: 20px;
      font-size: 12px;
      line-height: 18px;
    }
  }
  .compact-input-wrapper--custom {
    max-width: 220px;
  }
  .compact-input-wrapper--edns {
    max-width: 520px;
  }
  .compact-input-wrapper--concurrency {
    flex: 0 1 280px;
    max-width: 280px;
  }
  .edns-input-option {
    .des-label {
      margin-bottom: 2px;
    }
  }
  .inline-input-option {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 4px 0 6px;

    .des-label {
      flex: 0 0 auto;
      margin-bottom: 0;
    }

    .input-wrapper {
      flex: 1;
      min-width: 0;
    }
  }
</style>
