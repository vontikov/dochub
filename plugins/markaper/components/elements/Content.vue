<template>
  <dochub-object v-if="isObject" v-bind:src="src" />
  <iframe v-else class="iframe" v-bind:src="src" />
</template>

<script>
  export default {
    name: 'MKRContent',
    props: {
      // Требуем обязательно передавать ссылку на объект
      src: {
        type: String,
        required: true
      }
    },
    data() {
      return {
      };
    },
    computed: {
      isObject() {
        return (this.src).slice(0, 1) === '@';
      }
    }
  };
</script>

<style scoped>
  .iframe {
    width: 100%;
    height: 100%;
    border: none;    
    min-height: 480px;
  }
  
</style>
