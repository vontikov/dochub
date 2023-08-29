<template>
  <div>
    <dhsection 
      v-for="(item, index) in items"
      v-bind:key="index"
      v-bind:section="item" />
  </div>
</template>

<script>

  export default {
    name: 'MKRRow',
    components: {
      dhsection: () => import('./Section.vue')
    },
    props: {
      // Требуем обязательно передавать структуру секции
      items: {
        type: Array,
        required: true
      }
    },
    data() {
      return {
      };
    }
  };
</script>

<style scoped>
</style>
