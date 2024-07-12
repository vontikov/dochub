<template>
  <v-container class="grey lighten-5">
    <v-row>
      <v-col md="6" sm="12">
        <master-branch v-bind:status="status"/>
      </v-col>
      <v-col md="6" sm="12">
        {{ status }}
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import MasterBranch from './forms/MasterBranch.vue';
  import statusMixin from '../mixins/status';

  export default {
    name: 'GitManager',
    mixins: [statusMixin],
    components: {
      MasterBranch
    },
    data() {
      return {
      };
    }
  };
</script>

<style scoped></style>
