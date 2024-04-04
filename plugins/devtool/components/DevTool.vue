<template>
  <v-container class="desk" grid-list-xl fluid>
    <v-toolbar dense flat>
      <v-spacer />
      <v-btn v-show="!autoExec" icon title="Выполнить" v-on:click="manualExec(true)">
        <v-icon>mdi-arrow-right-drop-circle</v-icon>
      </v-btn>
      <v-btn icon title="Добавить панель" v-on:click="addTab()">
        <v-icon>mdi-plus</v-icon>
      </v-btn>
      <v-menu offset-y>
        <template #activator="{ on, attrs }">
          <v-btn icon v-bind="attrs" v-on="on">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item>
            <v-checkbox
              v-model="autoExec" />
            <v-list-item-title>Автовыполнение</v-list-item-title>
          </v-list-item>
          <v-list-item>
            <v-checkbox
              v-model="autoExpand" />
            <v-list-item-title>Не сворачивать ответ</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
      <template #extension>
        <v-tabs v-model="selectedTab" show-arrows>
          <v-tab v-for="(tab, index) in tabs" v-bind:key="tab.id" class="tab">
            <v-btn icon small title="Клонировать панель" class="btn-copy" v-on:click="cloneTab(index)">
              <v-icon x-small>mdi-content-copy</v-icon>
            </v-btn>
            {{ tab.name }}
            <v-btn v-if="tabs.length >= 2" icon small title="Удалить панель" class="btn-del" v-on:click="delTab(index)">
              <v-icon x-small>mdi-close</v-icon>
            </v-btn>
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>
    <split v-if="tabs.length" v-bind:direction="'vertical'">
      <split-area v-bind:size="40" class="area-space">
        <!-- TODO: минимальная высота на всю split-area или передача клика в input-->
        <!-- TODO: theme selector, но лучше просто light/dark-->
        <code-component v-if="tabs[selectedTab]" v-model="tabs[selectedTab].code" v-bind:change="onChange" />
      </split-area>
      <split-area v-bind:size="60" class="area-space">
        <div v-if="tabs[selectedTab]" class="response">
          <!-- TODO: loader здорового человека -->
          <div v-if="tabs[selectedTab].loading">Идет загрузка</div>
          <div v-else>
            <div v-if="tabs[selectedTab].emptyData">
              {{ tabs[selectedTab].emptyData }}
            </div>
            <div v-else-if="tabs[selectedTab].unexpectedError">
              {{ tabs[selectedTab].unexpectedError }}
            </div>
            <div v-else-if="tabs[selectedTab].error">
              <response-component v-if="tabs[selectedTab].error" v-bind:data="tabs[selectedTab].error" v-bind:auto-expand="autoExpand" />
            </div>
            <div v-else>
              <response-component v-if="tabs[selectedTab].response" v-bind:data="tabs[selectedTab].response" v-bind:auto-expand="autoExpand" />
            </div>
          </div>
        </div>
      </split-area>
    </split>
  </v-container>
</template>

<script>
  import cookie from 'vue-cookie';
  import CodeComponent from './CodeComponent.vue';
  import ResponseComponent from './ResponseComponent.vue';
  import env from '@front/helpers/env';

  const backendFileStorageURL = env.backendFileStorageURL();

  function uuidv4() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  function isServerFailStatus(statusCode) {
    return [403, 404, 501, 502, 503, 504].includes(statusCode);
  }

  const COOKIE_NAME_AUTOEXEC = 'json-dev-tool-new-autoexec';
  const COOKIE_NAME_AUTOEXPAND = 'json-dev-tool-new-autoexpand';
  const LOCALSTORAGE_NAME_TABS = 'json-dev-tool-new-tabs';
  const COOKIE_NAME_SELECTEDTAB = 'json-dev-tool-new-selectedtab';
  const TAB_DEFAULT = { 'response': {}, 'loading': false, 'error': null, 'unexpectedError': null, 'controller': null, 'emptyData': null};


  export default {
    name: 'DevTool',
    components: {CodeComponent, ResponseComponent},
    props: {
      pullData: {
        type: Function,
        required: true
      }
    },
    data() {
      return {
        selectedTab: parseInt(cookie.get(COOKIE_NAME_SELECTEDTAB) || 0),
        tabsCounter: 0,
        tabs: [],
        autoExpand: cookie.get(COOKIE_NAME_AUTOEXPAND) === 'true' ? true : false,
        autoExec: cookie.get(COOKIE_NAME_AUTOEXEC) === 'false' ? false : true
      };
    },
    watch: {
      autoExec(value) {
        value && this.exec();
        cookie.set(COOKIE_NAME_AUTOEXEC, value, 365);
      },
      autoExpand(value) {
        value && this.exec(); // TODO: тут не нужен перезапрос, но без него не работает
        cookie.set(COOKIE_NAME_AUTOEXPAND, value, 365);
      },
      selectedTab(value) {
        cookie.set(COOKIE_NAME_SELECTEDTAB, value, 365);
        if (this.autoExec){
          this.exec();
        }
      }
    },
    mounted() {

      this.onRefresh();
    },
    methods: {
      doRefresh() {
        if (localStorage.getItem(LOCALSTORAGE_NAME_TABS)) {
          try {
            const tabs = JSON.parse(localStorage.getItem(LOCALSTORAGE_NAME_TABS));
            this.tabs = tabs.map(tab => ({
              ...tab, ...TAB_DEFAULT
            }));
            this.tabsCounter = this.tabs.length;
            this.exec();
            return;
          } catch(e) {
            localStorage.removeItem(LOCALSTORAGE_NAME_TABS);
          }
        }
        this.addTab();
      },
      onRefresh() {
        if (this.refresher) clearTimeout(this.refresher);
        this.refresher = setTimeout(this.doRefresh, 50);
      },
      saveTabsToLocalStorage(){
        const tabs = this.tabs.map(tab => ({
          'id': tab.id, 'name': tab.name, 'code': tab.code
        }));
        localStorage.setItem(LOCALSTORAGE_NAME_TABS, JSON.stringify(tabs));
      },
      addTab() {
        const id = uuidv4();
        this.tabsCounter += 1;  // кол-во ключей в объекте tabs не получится использовать, т.к. при удалении-создании начнётся каша с нумерацией
        this.tabs.push({'id': id, 'name': `Панель #${this.tabsCounter}`, 'code': '', ...TAB_DEFAULT});
        this.saveTabsToLocalStorage();
      },
      cloneTab(id) {
        const oldTab = this.tabs[id];
        this.addTab();
        this.tabs[this.tabs.length - 1].code = oldTab.code;
      },
      delTab(id) {
        this.tabs.splice(id, 1);
        this.saveTabsToLocalStorage();
      },
      showEmpty(tab, data) {
        tab.emptyData = data || 'Пустой ответ от сервера';
      },
      showSuccess(tab, data) {
        tab.response = data;
      },
      showError(tab, data) {
        tab.error = data;
      },
      manualExec(){
        this.exec();
      },
      exec(){
        const currentTab = this.tabs[this.selectedTab];

        currentTab.error = null;
        currentTab.unexpectedError = null;
        currentTab.emptyData = null;
        currentTab.response = null;

        this.saveTabsToLocalStorage();

        if (!currentTab.code){
          this.showSuccess(currentTab, '');
          return;
        }

        if (env.isBackendMode()){
          this.backendExec(currentTab);
        }else{
          this.baseExec(currentTab);
        }
      },
      baseExec(currentTab){
        this.pullData(`(${currentTab.code})`).then(response => {
          if (response){
            this.showSuccess(currentTab, response);
          }else{
            this.showEmpty(currentTab);
          }
        }).catch(response => {
          this.showError(currentTab, response);
        });
      },
      async backendExec(currentTab){
        const showUnexpectedError = (data) => {
          currentTab.unexpectedError = data;
        };

        if (currentTab.controller && currentTab.controller.abort) {
          currentTab.controller.abort();
        }

        let request;
        currentTab.controller = new AbortController();

        currentTab.loading = true;

        try {
          request = await fetch(`${backendFileStorageURL}jsonata/(${encodeURIComponent(currentTab.code)})?params=null&subject=null`, {
            signal: currentTab.controller.signal
          });

        } catch (e) {
          if(e.name === 'AbortError') {
            return;
          }
          return showUnexpectedError(`Ошибка при обращении к API: ${e}`);
        }
        currentTab.loading = false;

        if (isServerFailStatus(request.status) ) {
          return showUnexpectedError(`Произошла ошибка на сервере: ${request.status}`);
        }

        let jsonData;
        try {
          jsonData = await request.json();
        } catch (e) {
          return this.showEmpty(currentTab);
        }

        if (request.status === 500) {
          return this.showError(currentTab, jsonData);
        }

        return this.showSuccess(currentTab, jsonData);
      },
      onChange(code) {
        const currentTab = this.tabs[this.selectedTab];

        currentTab.code = code;

        if (this.autoExec){
          this.exec();
        }
      }
    }
  };
</script>

<style scoped>
  header.v-toolbar {
    height: 96px;
  }
  .split:not(.area-space){
    height: calc(100% - 96px);
    border: solid 1px #eee;
  }
  .response {
    padding: 1em;
  }
  .btn-copy {
    opacity: 0;
  }
  .tab:hover .btn-copy {
    opacity: 1;
  }
</style>
