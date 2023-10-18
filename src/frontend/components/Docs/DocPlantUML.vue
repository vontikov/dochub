<template>
  <box>
    <plantuml v-if="uml" v-bind:uml="uml" v-bind:context-menu="contextMenu" />
  </box>
</template>

<script>
  import mustache from 'mustache';

  import Plantuml from '@front/components/Schema/PlantUML.vue';
  import requests from '@front/helpers/requests';
  
  import DocMixin from './DocMixin';

  export default {
    name: 'DocPlantUML',
    components: {
      Plantuml
    },
    mixins: [DocMixin],
    data() {
      return {
        content: ''
      };
    },
    computed: {
      uml() {
        let result = '';
        if (this.isTemplate) {
          this.source.dataset && (result = mustache.render(this.content, this.source.dataset));
        } else result = this.content;
        return result;
      }
    },
    methods: {
      refresh() {
        this.content = '';
        requests.request(this.url).then((response) => {
          this.content = response.data.toString();
        }).catch((e) => this.error = e);
        this.sourceRefresh();
      }
    }
  };
</script>

<style>

</style>
