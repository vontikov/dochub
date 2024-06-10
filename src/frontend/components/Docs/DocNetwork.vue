<template>
  <box class="space" />
</template>

<script>

  import { Network , DataSet } from 'vis-network/standalone/umd/vis-network.min';
  import DocMixin from './DocMixin';

  export default {
    name: 'DocNetwork',
    mixins: [DocMixin],
    data() {
      return {
        height: '400px'
      };
    },
    computed: {
      netData() {
        return this.source?.dataset;
      },
      isTemplate() {
        return true;
      }
    },
    watch: {
      netData() {
        this.network && this.network.destroy();
        this.network = new Network(this.$el, {
          nodes: new DataSet(this.netData?.nodes || []),
          edges: new DataSet(this.netData?.edges || [])
        }, Object.assign({
          // autoResize: true,
          locale: 'ru',
          clickToUse: true,
          layout: {
            randomSeed: 0
          },
          physics: {
            enabled: true,
            solver: 'repulsion'
          }
        }, this.netData?.options || {}));
      }
    },
    mounted() {
      this.height = `${this.$el.clientWidth * 0.6}px`;
    }
  };
</script>

<style scoped>

.space {
  padding: 0;
  aspect-ratio : 1 / 0.6;
  width: 100%;
  max-height: calc(100vh - 100px);
  min-width: 100%;
}

</style>
