<template>
  <v-alert type="error" icon="error">
    <pre class="err-exp-output" v-html="errorExplain" />
  </v-alert>
</template>

<script>
  export default {
    name: 'JSONataErrorExplainer',
    props: {
      error: {
        type: Object,
        default: null
      },
      query: {
        type: Object,
        default: null
      }
    },
    data() {
      return {
      };
    },
    computed: {
      errorExplain() {
        if (this.error) {
          const pos = this.error.position;
          let result = (`Error: ${this.error.message}`).replaceAll('\\n', '\n');
          if (this.query) result += `\n\n${this.query.slice(0, pos)} <span style="color:red"> ${this.query.slice(pos)} </span>`;
          return result;
        }
        return null;
      }
    }
  };
</script>

<style>
  .v-alert__content {
    max-width: 100%;
  }
  .err-exp-output {
    width: 100%;
    resize: none;
    padding: 0px;
    overflow-y: auto;
    word-wrap: break-word;
  }
</style>
