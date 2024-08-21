<template>
  <div>
    <v-container fluid class="d-flex justify-start flex-wrap">
      <v-flex v-for="(item, index) in pages" v-bind:key="index" md6 sm12 class="setting-item">
        <div style="width: 100%;">
          <h2 sm12>{{ getTitle(item.location) }}</h2>
          <component v-bind:is="item.component" sm12 />
        </div>
      </v-flex>
    </v-container>
  </div>
</template>
  
<script>
  export default {
    name: 'DocHubSettings',
    data() {
      return {
      };
    },
    computed: {
      pages() {
        return this.$store.state.plugins.uiSettings;
      }
    },
    methods: {
      getTitle(location) {
        return location.split('/').pop();
      }
    }
  };
</script>
  
<style scoped>

.setting-item {
    padding: 8px;
}

</style>
