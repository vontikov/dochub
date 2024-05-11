<template>
  <div class="document">
    <div v-bind:id="descId" class="desk" />
    <v-toolbar dense floating elevation="0" color="rgba(0, 0, 0, 0.03)" class="toolbar">
      <v-btn v-if="putContent" icon v-on:click="save">
        <v-icon>mdi-content-save</v-icon>
      </v-btn>
      <v-btn icon v-on:click="onExit">
        <v-icon>mdi-exit-run</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
  import BpmnModeler from 'bpmn-js/lib/Modeler';
  import BaseMixin from './BaseMixin.js';

  export default {
    mixins: [BaseMixin],
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
      }
    },
    data() {
      return {
        modeler: null,
        descId: `desc-${Date.now()}`,
        error: null
      };
    },
    methods: {
      onExit() {
        this.$emit('onEdit', false);
      },

      init() {
        this.modeler = new BpmnModeler({
          container: `#${this.descId}`,
          keyboard: {
            bindTo: window
          }
        });
      },
      applyContent(content) {
        this.modeler.importXML(content);
      },

      async save() {
        const { xml } = await this.modeler.saveXML({ format: true });
        //!!! Нужно перенести в успех сохранения
        this.$emit('input', xml);
        this.putContent(this.profile.source, xml)
          // Если все хорошо, рендерим HTML "как есть"
          .then(() => {
            alert('Сохраниль!');
          })
          // Если что-то пошло не так, генерируем HTML с ошибкой
          .catch((error) => {
            console.error(error);
            alert(`Полямялася! ${error.message}`);
          });

      }
    }
  };
</script>
<style scoped>
.desk {
  min-height: 1000px;
  height: calc(100vh - 48px);
  width: 100%;
  position: relative;
}

.document {
  position: relative;
}

.toolbar {
  position: absolute;
  left: 82px;
  top: 20px;
  background-color: 0 !important;
  color: 0 !important;
  border: 1px solid rgba(0, 0, 0, 0.2) !important;
}
</style>
