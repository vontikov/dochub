<template>
  <div class="json-viewer-box">
    <!-- разное поведение для preview-mode и expand-depth с большим числом. preview-mode слегка увеличивает производительность -->
    <json-viewer v-if="data" v-bind:value="data" v-bind:expand-depth="expandDepth" v-bind:show-double-quotes="true" v-bind:preview-mode="autoExpand" v-bind:copyable="copyable" v-bind:show-array-index="false" />
  </div>
</template>

<script>
  import JsonViewer from 'vue-json-viewer';
  import 'vue-json-viewer/style.css';


  export default {
    name: 'ResponseComponent',
    components: {JsonViewer},
    props: {
      data: {
        type: [Object, Array],
        required: true
      },
      autoExpand: {
        type: Boolean,
        required: true
      }
    },
    data() {
      return {
        copyable: {
          copyText: 'Копировать',
          copiedText: 'Скопировано',
          timeout: 2000
        }
      };
    },
    computed: {
      expandDepth() {
        return (this.autoExpand === true) ? 1000 : 1;
      }
    }
  };
</script>

<style>
  .json-viewer-box .jv-container .jv-code {
    padding: 0;
  }
  .json-viewer-box .jv-container.jv-light {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
  }
</style>
