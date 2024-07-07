import { init } from './bootstrap';

const app = init(process.env);

document.addEventListener('DOMContentLoaded', async() => {
  const {
    Vue,
    Root,
    router,
    vuetify,
    store
  } = await app;

  new Vue({
    router,
    render(createElement) {
      return createElement(Root);
    },
    vuetify,
    store
  }).$mount('#app');

  store.dispatch('init');

  window.$PAPI?.loaded && window.$PAPI.loaded();
});
