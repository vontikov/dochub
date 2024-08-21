<template>
  <v-combobox 
    v-if="status?.isLogined"
    v-model="select"
    class="selector"
    v-bind:items="items" />
</template>

<script>

  export default {
    name: 'BranchSelector',
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
    watch: {
      status() {
        this.refreshSelector();
      }
    },
    mounted() {
      DocHub.eventBus.$on('gitlab-status-change', (status) => this.status = status);
      DocHub.eventBus.$emit('gitlab-status-get');
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
