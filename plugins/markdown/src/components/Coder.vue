<template>
  <div class="markdown-coder" />
</template>

<script>
  import { basicSetup, EditorView } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { EditorState } from '@codemirror/state';
 
  export default {
    name: 'MarkdownCoder',
    props: {
      code: {
        type: String,
        required: false,
        default: ''
      },
      api: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        editor: null,
        state: null,
        edited: null
      };
    },
    watch: {
      code(value) {
        this.rebuildEditor(value);
      }
    },
    mounted() {
      this.api.getCode = () => this.edited || this.code;
      this.rebuildEditor();
    },
    beforeDestroy() {
      this.freeEditor();
    },
    methods: {
      freeEditor() {
        this.editor?.destroy();
        this.editor = null;
        this.state = null;
        this.edited = null;
        this.$emit('onchange', false);
      },
      rebuildEditor(code = false) {
        this.freeEditor();
        const autoLanguage = EditorState.transactionExtender.of(tr => {
          if (tr.docChanged) {
            this.edited = tr.newDoc.toString();
            this.$emit('onchange', true);
          }
          return {};
        });
        this.state = EditorState.create({
          doc: code !== false ? code : this.code,
          extensions: [
            basicSetup,
            markdown({ codeLanguages: languages }),
            autoLanguage
          ]
        });
        this.editor = new EditorView({
          state: this.state,
          parent: this.$el
        });
      }
    }
  };
</script>

<style scoped>

.markdown-coder {
  width: 100%;
  min-height: 400px;
}

</style>
