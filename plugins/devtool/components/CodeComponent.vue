<template>
  <div class="crutch">
    <codemirror ref="codemirror" v-model="cmCode" v-bind:options="cmOptions" />
  </div>
</template>

<script>
  // import { ref } from 'vue';
  import { codemirror } from 'vue-codemirror';
  import { CodeMirror } from 'vue-codemirror';
  import 'codemirror/lib/codemirror.css';
  import 'codemirror/theme/dracula.css';
  import {parser} from './jsonata';

  CodeMirror.defineMode('jsonata', parser);

  export default {
    name: 'CodeComponent',
    components: {codemirror},
    model: {
      prop: 'modelValue',
      event: 'update:modelValue'
    },
    props: {
      modelValue: {
        type: String,
        default: ''
      },
      change: {
        type: Function,
        required: true
      }
    },

    data() {
      return {
        cmOptions: {
          tabSize: 4,
          mode: 'jsonata',
          theme: 'dracula',
          lineNumbers: true,
          line: true,
          viewportMargin: 1
        }
      };
    },
    computed: {
      cmCode: {
        get() {
          return this.modelValue;
        },
        set(value) {
          this.change(value);
        }
      }
    }
  };
</script>

<style>
  .CodeMirror {
    height: auto;
  }
  .crutch {
    background-color: #282a36 !important;
    color: #f8f8f2 !important;
    height: 100%;
  }
</style>
