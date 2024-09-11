<template>
  <v-footer
    v-if="isEditing"
    app
    clipped-left
    color="#3495db"
    v-bind:class="isPrintVersion ? 'print-version' : ''"
    class="dochub-footer">
    <editor-tabs />
  </v-footer>
</template>

<script>
  import EditorTabs from './Editor/Tabs.vue';

  export default {
    name: 'Header',
    components: {
      EditorTabs
    },
    data() {
      return {
      };
    },
    computed: {
      isEditing() {
        return this.$store.state.editors?.contexts?.length;
      },
      isPrintVersion() {
        return this.$store.state.isPrintVersion;
      },
      isFullScreenMode() {
        return this.$store.state.isFullScreenMode;
      }
    },
    methods: {
    }
  };
</script>

<style scoped>

footer.print-version {
  position: absolute;
}

.dochub-footer {
  z-index: 100;
}

</style>
