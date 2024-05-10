<template>
  <vue-bpmn 
    url="/public/temp/diagram.bpmn"
    v-bind:options="options"
    v-on:error="handleError"
    v-on:shown="handleShown"
    v-on:loading="handleLoading" />
</template>

<script>
  import VueBpmn from 'vue-bpmn';

  export default {
    components: {
      VueBpmn
    },
    data() {
      return {
        options: {
          propertiesPanel: {},
          additionalModules: [],
          moddleExtensions: []
        }
      };
    },
    methods: {
      handleError: function(err) {
        console.error('failed to show diagram', err);
      },
      handleShown: function() {
        console.log('diagram shown');
      },
      handleLoading: function() {
        console.log('diagram loading');
      }
    }
  };
</script>
