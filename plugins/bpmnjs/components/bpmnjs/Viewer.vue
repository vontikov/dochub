<template>
  <div class="bpmnjs-space bpmnjs-document-viewer">
    <div
      v-html="`
      <style>
        .bpmnjs-document-viewer .bjs-breadcrumbs {
          left: 70px !important;
          top: 34px !important;
        }    
      </style>
    `" />
    <div ref="container" class="bpmnjs-viewer" v-bind:style="{ height}" />
    <v-toolbar
      v-if="putContent"
      dense
      floating 
      elevation="0"
      color="rgba(0, 0, 0, 0.03)"
      class="toolbar">
      <v-btn icon title="Редактировать" v-on:click="onEdit">
        <v-icon>mdi-file-edit-outline</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
  import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
  import BaseMixin from './BaseMixin.js';

  export default {
    mixins: [BaseMixin],
    data() {
      return {
        bpmnViewer: null,
        height: '50vh'
      };
    },
    methods: {
      init() {
        this.bpmnViewer = new BpmnJS({
          container: this.$refs.container
        });
        this.bpmnViewer.on('import.done', (event) => {
          event.error && this.registerError(event.error);
          event.warnings && this.registerWarning(event.warnings);
          this.bpmnViewer.get('canvas').zoom('fit-viewport');
          //todo Стоит оптимизировать высоту изображения
          // const rect = this.bpmnViewer.get('canvas')._viewport.getBoundingClientRect();
        });
      },
      applyContent(content) {
        this.bpmnViewer.importXML(content);
      },
      onEdit() {
        this.$emit('onEdit', true);
      }
    }
  };
</script>

<style scoped>
.bpmnjs-space {
  position: relative;
  height: 50vh;
  width: 100%;
}

.bpmnjs-viewer {
  height: 50vh;
  width: 100%;
}

.bpmnjs-space:hover .toolbar {
  display: block;
} 

.bpmnjs-space .toolbar {
  display: none;
  position: absolute;
  left: 20px;
  top: 20px;
  background-color: 0 !important;
  color: 0 !important;
  border: 1px solid rgba(0, 0, 0, 0.2) !important;
}

</style>
