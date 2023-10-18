<template>
  <div 
    style="width: 160px; height: 32px; left: 50%; top: 50%; position: absolute; margin-left: -80px; margin-top: -16px; text-align:center;">
    <template v-if="isLoading">
      Вжуууух...
    </template>
    <template v-else>
      Упс... здесь пусто :(
      <div v-if="isPlugin" style="margin-left: -50%;" class="location">
        {{ currentURL }}
      </div>
    </template>
  </div>
</template>

<script>
  import env from '@front/helpers/env';
  export default {
    name: 'Empty',
    data() {
      return {
        currentURL: window.location.toString()
      };
    },
    computed: {
      isPlugin() {
        return env.isPlugin();
      },
      isLoading() {
        return this.$store.state.isReloading;
      }
    },
    watch: {
      '$route'() {
        this.currentURL = window.location.toString();
      }
    }
  };
</script>

<style scoped>

.location {
  margin-top: 24px;
  margin-left: -115px !important;
  width: 400px;
  word-wrap: inherit;
  font-size: 10px;
}


</style>
