<template>
  <div>
    <v-container fluid class="d-flex justify-start flex-wrap">
      <v-flex v-for="(item, index) in pages" v-bind:key="index" md6 sm12 class="setting-item">
        <div class="setting-content">
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
    
}


.setting-content {
  width: calc(100% - 8px);
  box-shadow: rgba(0, 0, 0, 0.2) 0px 3px 1px -2px, rgba(0, 0, 0, 0.14) 0px 2px 2px 0px, rgba(0, 0, 0, 0.12) 0px 1px 5px 0px;
  margin: 4px;
  padding: 8px;
}

</style>
