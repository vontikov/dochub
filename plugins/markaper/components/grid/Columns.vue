<template>
  <div class="mkr-grid-row">
    <dhsection
      v-for="(item, index) in items"
      v-bind:key="index"
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
    display: grid;
    grid-template-columns: 0.8fr 1fr;
  }
  @media (max-width: 640px) {
    .mkr-grid-row {
      grid-template-columns: 1fr;
    }
  }

</style>
