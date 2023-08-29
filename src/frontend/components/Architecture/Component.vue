<template>
  <entity
    entity="components"
    presentation="blank"
    v-bind:params="{ 'dh-component-id': component }" />
</template>

<script>
  import Entity from '@front/components/Entities/Entity.vue';

  export default {
    name: 'ArchComponent',
    components: {
      Entity
    },
    props: {
      component: { type: String, default: '' }
    },
    data() {
      return {
      };
    }
  };
</script>

<style scoped>
</style>
