// See icons https://fonts.google.com/icons?selected=Material+Icons
import '@assets/styles/material_icons.css';
import '@/node_modules/@mdi/font/css/materialdesignicons.min.css';

// Подсветка синтаксиса
import '@assets/styles/prism.css';
import '@assets/libs/prism';

import Axios from 'axios';
import Vue from 'vue';
import VueCookie from 'vue-cookie';
import Vuetify from 'vuetify';
import Vuex from 'vuex';
import '@idea/papi';
import AsyncComputed from 'vue-async-computed';
import VsCode from '@vscode';
import Root from '@front/components/Root.vue';
import router from './router';
import VueSplit from '@assets/libs/vue-split-panel.min';

import Aspect from '@front/components/Architecture/Aspect.vue';
import Component from '@front/components/Architecture/Component.vue';
import Context from '@front/components/Architecture/Context.vue';
import DocHubDoc from '@front/components/Docs/DocHubDoc.vue';
import PlantUML from '@front/components/Schema/PlantUML.vue';
import Radar from '@front/components/Techradar/Main.vue';
import Technology from '@front/components/Techradar/Technology.vue';
import Anchor from '@front/components/Tools/Anchor.vue';
import Image from '@front/components/Tools/Image.vue';
import Youtube from '@front/components/Tools/Youtube.vue';
import Entity from '@front/components/Entities/Entity.vue';
import DocHubObject from '@front/components/Docs/DocHubObject';
import GlobalMixin from '@front/mixins/global';
import gitlab from '@front/storage/gitlab';

import '@assets/styles/main.css';
import '@front/storage/indexedDB';
import 'swagger-ui/dist/swagger-ui.css';
import 'vuetify/dist/vuetify.min.css';

window.Vue = Vue;
window.Router = router;
window.EventBus = new Vue();

Vue.use(Vuex);
Vue.use(Vuetify);
Vue.use(VueCookie);
Vue.use(VueSplit);
Vue.use(AsyncComputed);

Vue.prototype.$axios = Axios;
Vuex.Store.prototype.$axios = Axios;

if (window.DochubVsCodeExt) {
  VsCode.pipe();
}

let store = new Vuex.Store(gitlab);

if (window.DochubVsCodeExt) {
  VsCode.listener(store);
}

window.Vuex = store;

store.dispatch('init');

Vue.component('DochubObject', DocHubObject);
Vue.component('DochubDoc', DocHubDoc);
Vue.component('DochubContext', Context);
Vue.component('DochubComponent', Component);
Vue.component('DochubAspect', Aspect);
Vue.component('DochubAnchor', Anchor);
Vue.component('DochubImage', Image);
Vue.component('DochubYoutube', Youtube);
Vue.component('DochubTechnology', Technology);
Vue.component('DochubRadar', Radar);
Vue.component('DochubPlantuml', PlantUML);
Vue.component('DochubEntity', Entity);

Vue.mixin(GlobalMixin);
Vue.config.ignoredElements = ['asyncapi-component'];

const vuetify = new Vuetify({
  icons: {
    iconfont: 'mdi'
  }
});

export default {
  router,
  vuetify,
  store,
  Vue,
  Root
};
