<template>
  <div class="bpmnjs-space">
    <div ref="container" class="bpmnjs-viewer" />
    <v-toolbar
      dense
      floating 
      elevation="0"
      color="rgba(0, 0, 0, 0.03)"
      class="toolbar">
      <v-btn v-if="putContent" icon title="Редактировать" v-on:click="onEdit">
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
        bpmnViewer: null
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
