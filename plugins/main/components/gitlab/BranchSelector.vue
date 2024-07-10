<template>
  <v-combobox 
    class="selector"
    v-if="status?.isLogined"
    v-model="select"
    v-bind:items="items">
  </v-combobox>
</template>

<script>

  export default {
    name: 'BranchSelector',
    mounted() {
      DocHub.eventBus.$on('gitlab-status-change', (status) => this.status = status);
      DocHub.eventBus.$emit('gitlab-status-get');
    },
    watch: {
      status() {
        this.refreshSelector();
      }
    },
    data() {
      return {
        status: null,
        items: []
      };
    },
    computed: {
      select: {
        get() {
          return this.status?.api.currentBranch();
        },
        set(to) {
          this.status?.api.checkout(to);
        }
      }
    },
    methods: {
      // Обновляем информацию о бранчах
      async refreshSelector() {
        this.items = (await this.status?.api.fetchBranches()).map((item) => item.name);
      }
    }
  };
</script>

<style scoped>
.selector {
  max-width: 400px;
  margin-right: 4px;
  margin-left: 4px;
  margin-top: 16px;
}
</style>
