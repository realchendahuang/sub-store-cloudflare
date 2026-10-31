import '@/assets/styles/fonts.scss';
import '@/assets/styles/global.scss';
import '@/assets/styles/overwritten_css_var.scss';
import SvgIcon from '@/components/SvgIcon.vue';
import i18n from '@/locales';
import '@/plugin/awesomeIcon';

import nutUi from '@/plugin/nutui';
import '@/plugin/touch'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import 'modern-css-reset/dist/reset.min.css';
import '@/assets/styles/reduced-motion-fix.scss';
import { createPinia } from 'pinia';
import 'virtual:svg-icons-register';
import { createApp } from 'vue';
import { setUnauthorizedHandler } from '@/api';
import { syncAdminTokenFromUrl } from '@/utils/adminToken';
import { resetToTokenEntry } from '@/utils/session';

import App from './App.vue';

async function initializeApp() {
  syncAdminTokenFromUrl();
  const { default: router } = await import('@/router');

  // 创建一个回调函数来处理变化
  const callback = function(mutationsList, observer) {
    for(let mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (document.body.classList.contains('nut-overflow-hidden')) {
                document.body.classList.remove('nut-overflow-hidden');
            }
        }
    }
  };

  // 创建一个观察器实例，将回调函数作为参数
  const observer = new MutationObserver(callback);

  // 开始观察`body`元素上的`class`属性的变化
  observer.observe(document.body, { attributes: true });
  const pinia = createPinia();
  const app = createApp(App);

  nutUi(app);
  app.use(router);
  app.use(pinia);
  app.use(i18n);
  // 401：清除 token 并回到 token 输入界面
  setUnauthorizedHandler(() => {
    void resetToTokenEntry(router);
  });
  app.component('font-awesome-icon', FontAwesomeIcon);
  app.component('svg-icon', SvgIcon);
  app.mount('#app');
}

void initializeApp();
