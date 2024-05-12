<template>
  <div class="bpmnjs">
    <modeler
      v-if="isEdit"
      v-model="content"
      v-bind:profile="profile"
      v-bind:get-content="getContent"
      v-bind:put-content="proxyPutContent" 
      v-on:onEdit="onEdit" />
    <viewer 
      v-else
      v-model="content"
      v-bind:profile="profile"
      v-bind:get-content="getContent"
      v-bind:put-content="proxyPutContent" 
      v-on:onEdit="onEdit" />
  </div>
</template>

<script>
  import modeler from './Modeler.vue';
  import viewer from './Viewer.vue';
  import emptyDiagram from '!!raw-loader!../../resource/empty.bpmn';

  export default {
    components: {
      modeler,
      viewer
    },
    props: {
      // Требуем обязательно передавать профайл документа 
      profile: {
        type: Object,
        required: true
      },
      // Требуем обязательно передавать функцию получения контента
      getContent: {
        type: Function,
        required: true
      },
      // Требуем обязательно передавать функцию сохранения контента
      putContent: {
        type: Function,
        required: true
      },
      // Шина событий
      eventBus: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        isEdit: false,
        content: emptyDiagram,
        error: null,
        source: null,
        updateCommit: 0
      };
    },
    computed: {
      // Обработчик сохранения данных
      // eslint-disable-next-line vue/return-in-computed-property
      proxyPutContent() {
        if (!this.putContent) return null;
        // eslint-disable-next-line vue/no-async-in-computed-properties
        return (source, xml) => {
          return new Promise((success, reject) => {
            this.beginUpdate();
            this.putContent(source, xml)
              .then(success)
              .catch(reject);
          });
        };
      }
    },
    watch: {
      profile(value) {
        (value.source !== this.source) && this.reload();
      }
    },
    mounted() {
      this.reload();
      // Обработчик события обновления данных
      this.eventBus.$on('on-changed-source', (source) => {
        source.endsWith(this.profile.source) && this.endUpdate() && this.reload();
      });
    },
    methods: {
      // Процесс обновления начат
      beginUpdate() {
        setTimeout(() => this.endUpdate(), 3000); // Таймаут для обновления
        return !!(++this.updateCommit);
      },
      // Процесс обновления завершен
      endUpdate() {
        return !(this.updateCommit>0 && this.updateCommit--);
      },
      // Переход в режим редактирования
      onEdit(mode) {
        this.isEdit = mode;
      },
      // Загрузка контента
      async reload() {
        this.getContent(this.profile.source)
          .then((response) => {
            this.source = this.profile.source;
            this.content = response.data || emptyDiagram;
          })
          .catch((error) => {
            this.content = emptyDiagram;
            this.error = `Ошибка загрузки файла [${this.profile.source}]: <br> ${error}</div>`;
          });
      }
    }
  };
</script>

<style scoped>

.bpmnjs {
  min-height: 400px;
}

.bpmnjs:hover {
  margin: -1px;
  border: 1px solid rgba(0, 0, 0, 0.2) !important;
  border-radius: 4px;
}

</style>
