<template>
  <box v-bind:id="dom_id" v-bind:class="getClass" />
</template>

<script>
  import SwaggerUI from 'swagger-ui';

  import DocMixin from './DocMixin';
  import { getAsyncApiContext } from '@front/helpers/misc';

  export default {
    name: 'DocSwagger',
    mixins: [DocMixin],
    data() {
      return {
        dom_id : `swagger-${Date.now()}-${Math.round(Math.random() * 10000)}`,
        data: null
      };
    },
    computed: {
      getClass() {
        return this.inline ? 'sgr-inline' : 'sgr-not-inline';
      }
    },
    watch: {
      isPrintVersion() {
        const el = document.getElementById(this.dom_id);
        el.innerHTML = '';
        this.$nextTick(this.swaggerRender);
      }
    },
    methods: {
      refresh() {
        getAsyncApiContext.call(this, true);
      },

      swaggerRender() {
        if (this.url) {
          SwaggerUI({
            dom_id: `#${this.dom_id}`,
            spec: this.data,
            deepLinking: true,
            docExpansion: this.isPrintVersion ? 'full' : 'list',
            presets: [
              SwaggerUI.presets.apis
            ]
          });
        }
      }
    }
  };
</script>

<style>
.sgr-not-inline {
  padding: 16px;
  width: 100%;
}

.swagger-ui .opblock .opblock-summary-path {
    min-width: 100px;
}

</style>
