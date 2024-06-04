<template>
  <box>
    <section ref="asyncApi" />
  </box>
</template>

<script>
  import '@assets/styles/asyncapi.min.css';
  import AsyncApiStandalone from '@asyncapi/react-component/browser/standalone';

  import DocMixin from './DocMixin';
  import { getAsyncApiContext } from '@front/helpers/misc';

  export default {
    name: 'DocAsyncApi',
    mixins: [DocMixin],
    methods: {
      renderRefSection(res) {
        AsyncApiStandalone.render({
          schema: res.data
        }, this.$refs.asyncApi);
      },
      refresh() {
        getAsyncApiContext.call(this);
      }
    }
  };
</script>
