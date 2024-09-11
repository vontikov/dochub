<template>
  <div
    :class="{ 'dochub-document-core': true, 'edit-mode-ready': isEditScanning, hover: isHover && isEditScanning }"
    @mouseover="onHover"
    @mouseleave="onLive">
    <v-alert v-if="!isReloading && error" icon="error" type="error">
      <h2>Ошибка!</h2>
      <div>Расположение: {{ path }}</div>
      <div>{{ error }}</div>
    </v-alert>
    <template v-if="!isReloading && !error">
      <component
        :is="is"
        v-if="is"
        ref="component"
        v-model="state"
        :inline="inline"
        :editor="editor"
        :params="currentParams"
        :profile="profile"
        :path="currentPath"
        :get-content="getContentForPlugin"
        :put-content="putContentForPlugin"
        :to-print="isPrintVersion"
        :pull-data="pullData"
        :event-bus="eventBus"
        @context-menu="contextMenu" />
      <template v-else>
        <v-alert v-if="profile && !isReloading" icon="warning">
          Неизвестный тип {{ editor ? 'редактора' : 'документа' }} [{{ docType }}]<br>
          Path: {{ currentPath }}<br>
          Params: {{ currentParams }}<br>
          Profile: <br>
          <pre>{{ JSON.stringify(profile, null, 2) }}</pre>
        </v-alert>
        <spinner v-else />
      </template>
    </template>
  </div>
</template>

<script>
  import { DocHub } from 'dochub-sdk';
  import { DocTypes } from '@front/components/Docs/enums/doc-types.enum';
  import AsyncApiComponent from '@front/components/Docs/DocAsyncApi.vue';
  import Empty from '@front/components/Controls/Empty.vue';
  import requests from '@front/helpers/requests';
  import datasets from '@front/helpers/datasets';
  import query from '@front/manifest/query';
  import uriTool from '@front/helpers/uri';
  import env from '@front/helpers/env';
  import { EditMode } from '@front/plugins/editors';
  
  import Swagger from './DocSwagger.vue';
  import Plantuml from './DocPlantUML.vue';
  import DocMarkdown from './DocMarkdown.vue';
  import DocTable from './DocTable.vue';
  import DocMermaid from './DocMermaid.vue';
  import DocNetwork from './DocNetwork.vue';
  import DocSmartants from './DocSmartAnts.vue';
  import Spinner from '@front/components/Controls/Spinner.vue';

  // Встроенные типы документов
  const inbuiltTypes = {
    [DocTypes.ASYNCAPI]: 'async-api-component',
    [DocTypes.OPENAPI]: 'swagger',
    [DocTypes.PLANTUML]: 'plantuml',
    // [DocTypes.MARKDOWN]: 'doc-markdown',
    [DocTypes.TABLE]: 'doc-table',
    [DocTypes.MERMAID]: 'doc-mermaid',
    [DocTypes.NETWORK]: 'doc-network',
    [DocTypes.SMARTANTS]: 'doc-smartants'
  };


  export default {
    name: 'DocHubDoc',
    components: {
      AsyncApiComponent,
      Plantuml,
      Swagger,
      DocMarkdown,
      DocTable,
      Empty,
      DocMermaid,
      DocNetwork,
      DocSmartants,
      Spinner
    },
    props: {
      path: {
        type: String,
        default: '$URL$'
      },
      inline: { type: Boolean, default: false },
      editor: { type: Boolean, default: false },
      // Параметры передающиеся в запросы документа
      // Если undefined - берутся из URL
      params: {
        type: Object,
        default: undefined
      },
      contextMenu: {
        type: Array,
        default() {
          return [];
        }
      }
    },
    data() {
      return {
        state: null,
        isHover: false, 
        DocTypes,
        refresher: setTimeout(() => true, 1000), // Заглушка на время старта документа
        profile: null,
        error: null,
        currentPath: this.resolvePath(),
        currentParams: this.resolveParams(),
        dataProvider: datasets()
      };
    },
    computed: {
      // Определяет режим поиска объекта редактирования
      isEditScanning() {
        return !this.editor
          && (this.$store.state.editors.mode === EditMode.edit)
          && DocHub.editors.fetch().includes(this.docType);
      },
      eventBus() {
        return DocHub.eventBus;
      },
      is() {
        return this.docType && (inbuiltTypes[this.docType] || `plugin-${this.editor ? 'editor' : 'document'}-${this.docType}`);
      },
      docType() {
        return (this.profile?.type || '').toLowerCase();
      },
      baseURI() {
        return uriTool.getBaseURIOfPath(this.currentPath);
      },
      isReloadingManifest() {
        return this.$store.state.isReloading;
      },
      isReloading() {
        return this.isReloadingManifest || !!this.refresher;
      },
      isPrintVersion() {
        return this.$store.state.isPrintVersion;
      },
      putContentForPlugin() {
        if (env.isPlugin()) {
          return (url, content) => {
            if (!url) throw new Error('URL of document is not defined!');
            return new Promise((success, reject) => {
              const fullPath = uriTool.makeURIByBaseURI(url, this.baseURI);
              window.$PAPI.pushFile(fullPath, content)
                .then(success)
                .catch(reject);
            });
          };
        } else {
          return (url, data) => {
            if (!url) throw new Error('URL of document is not defined!');
            return requests.request(url, this.baseURI, {
              method: 'put',
              headers: {
                'Content-type': 'text/plain; charset=UTF-8'
              },
              data
            });
          };
        }
      }
    },
    watch: {
      state(value) {
        this.$emit('input', value);
      },
      '$route.path'() {
        this.refresh();
      },
      params() {
        this.refresh();
      },
      isReloadingManifest() {
        this.refresh();
      }
    },
    created() {
      window.addEventListener('mousedown', this.onHookMouseDown);
    },
    destroyed() {
      window.removeEventListener('mousedown', this.onHookMouseDown);
    },
    mounted() {
      this.refresh();
    },
    methods: {
      onHookMouseDown() {
        if (this.isHover && this.isEditScanning) {
          const params = this.resolveParams();
          const url = new URL(this.path, window.location.href);
          Object.keys(params).map((key) => url.searchParams.append(key, params[key].toString()));
          this.$store.dispatch('openEditor', {
            documentPath: `${url.pathname}${url.search}`,
            title: this.currentPath
          });
          this.$store.commit('setPortalMode', EditMode.view);
        }
        return false;
      },
      onHover(event) {
        for(let element = event.target; element; element = element.parentNode) {
          if (typeof element.className?.includes === 'function' &&  element.className?.includes('dochub-document-core')) {
            this.isHover = element === this.$el;
            return;
          }
        }
        this.isHover = false;
      },
      onLive() {
        this.isHover = false;
      },
      pullProfileFromResource(uri) {
        requests.request(uri).then((response) => {
          const contentType = (response?.headers['content-type'] || '').split(';')[0].split('/')[1];
          this.profile = {
            type: contentType,
            source: `source:${encodeURIComponent(JSON.stringify(response.data))}`
          };
        }).finally(() => {
          this.refresher = null;
        });
      },
      // Достаем данные профиля документа из DataLake
      pullProfileFromDataLake(dateLakeId) {
        query.expression(query.getObject(dateLakeId), null, this.resolveParams())
          .evaluate()
          .then((profile) => {
            this.profile = Object.assign({ $base: this.path }, profile);
          })
          .catch((e) => {
            this.error = e.message;
          })
          .finally(() => {
            this.currentPath = this.resolvePath();
            this.currentParams = this.resolveParams();
            this.refresher = null;
          });
      },
      // Обновляем контент документа
      refresh() {
        if (this.refresher) clearTimeout(this.refresher);
        this.refresher = setTimeout(() => {
          this.profile = null;
          const path = this.resolvePath().slice(1).split('/');
          if (path[1].startsWith('blob:') || (path[1].slice(-1) === ':')) {
            this.pullProfileFromResource(path.slice(1).join('/'));
          } else {
            this.pullProfileFromDataLake(`"${path.join('"."')}"`);
          }
        }, 50);
      },
      resolveParams() {
        return Object.assign({}, this.params || {}, this.$router.currentRoute.query || {});
      },
      // Определяем текущий путь к профилю документа
      resolvePath() {
        if (this.path === '$URL$') return this.$router.history.current.path;
        return this.profile?.$base || this.path;
      },
      // Провайдер контента файлов для плагинов
      //  url - прямой или относительный URL к файлу
      getContentForPlugin(url) {
        return new Promise((success, reject) => {
          const whiter = setInterval(() => {
            if (!this.isReloading) {
              requests.request(url, this.baseURI, { raw: true })
                .then(success)
                .catch(reject);
              clearInterval(whiter);
            }
          }, 50);
        });
      },
      // API к озеру данных архитектуры
      //  expression - JSONata запрос или идентификатор ресурса
      //  self - значение переменной $self в запросе
      //  params - значение переменной $params в запросе
      //  context - контекст запроса (по умолчанию равен manifest)
      pullData(expression, self_, params, context) {
        if (!expression) {
          return this.dataProvider.releaseData(this.resolvePath(), params || this.params);
        } else
          return this.dataProvider.getData(context, { source: expression }, params);
      }
    }
  };
</script>

<style scoped>

.dochub-document-core.edit-mode-ready {
  box-sizing: border-box;
  -moz-box-sizing: border-box;
  -webkit-box-sizing: border-box;  
  border: 3px dotted #ffeb3b;
  border-radius: 2px;
  padding: 6px;
}

.dochub-document-core.edit-mode-ready.hover {
  cursor: context-menu;
  border: 4px dotted #ffeb3b !important;
  padding: 4px;
}

.dochub-document-core.edit-mode-ready {
    transition: all 0.15s ease-in;
}

</style>
