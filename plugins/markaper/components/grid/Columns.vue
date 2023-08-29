<template>
  <div class="mkr-grid-row">
    <dhsection 
      v-for="(item, index) in items"
      v-bind:key="index"
      v-bind:style="makeStyle(item)"
      class="mkr-grid-col"
      v-bind:section="item" />
  </div>
</template>

<script>

  export default {
    name: 'MKRColumn',
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
    },
    computed: {
    },
    methods: {
      makeStyle(item) {
        const result = {};
        item.width && (result['max-width'] = item.width);
        return result;
      }
    }

  };
</script>

<style scoped>
  .mkr-grid-row {
    display: flex;
  }

  .mkr-grid-col {
    flex: 1;
  }

</style>
