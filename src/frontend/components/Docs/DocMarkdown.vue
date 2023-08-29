<template>
  <box class="space">
    <context-menu v-model="menu.show" v-bind:x="menu.x" v-bind:y="menu.y" v-bind:items="contextMenu" />
    <dochub-anchor id="" />
    <div v-if="toc" class="toc" v-html="toc" />
    <markdown
      v-if="(markdown !== null)"
      toc
      v-bind:breaks="false"
      v-bind:html="false"
      v-bind:postrender="rendered"
      v-on:toc-rendered="tocRendered">
      {{ markdown }}
    </markdown>
    <final-markdown 
      v-if="showDocument"
      v-bind:template="outHTML"
      v-bind:base-u-r-i="url" />
    <spinner v-else />
  </box>
</template>

<script>
  import markdown from 'vue-markdown';
  import mustache from 'mustache';

  import requests from '@front/helpers/requests';
  import href from '@front/helpers/href';
  
  import DocMarkdownObject from './DocHubObject';
  import DocMixin from './DocMixin';
  import ContextMenu from './DocContextMenu.vue';
  import Spinner from '@front/components/Controls/Spinner.vue';

  export default {
    name: 'DocMarkdown',
    components: {
      markdown,
      ContextMenu,
      Spinner,
      finalMarkdown: {
        components: {
          'dochub-object': DocMarkdownObject
        },
        props: {
          template: { type: String, default: '' },
          baseURI: { type: String, default: '' }
        },
        created() {
          this.$options.template = `<div class="markdown-document">${this.template}</div>`;
        },
        mounted() {
          href.elProcessing(this.$el);
        }
      }
    },
    mixins: [DocMixin],
    props: {
      tocShow: {
        type: Boolean,
        default: true
      }
    },
    data() {
      return {
        showDocument: false,
        toc: '',
        markdown: null,
        outHTML: null
      };
    },
    methods: {
      rendered(outHtml) {
        const result = outHtml.replace(/<img /g, '<dochub-object :baseURI="baseURI" :inline="true" ')
          .replace(/\{\{/g, '<span v-pre>{{</span>')
          .replace(/\}\}/g, '<span v-pre>}}</span>');
        if (this.outHTML != result) {
          this.showDocument = false;
          this.outHTML = result;
          this.$nextTick(() => {
            this.showDocument = true;
            window.location.hash && setTimeout(() => window.location.href = window.location.hash, 50);
          });
        }
        // eslint-disable-next-line no-undef
        Prism.highlightAll();
        return '';
      },
      tocRendered(tocHTML) {
        // Не выводим оглавление, если в нем всего три раздела или меньше
        // eslint-disable-next-line no-useless-escape
        if (this.tocShow && ((tocHTML.match(/\<li\>.*\<\/li\>/g) || []).length > 3)) 
          this.toc = tocHTML;
      },
      refresh() {
        this.markdown = null;
        if (!this.url) return;
        this.outHTML = null;
        this.showDocument = false;
        this.toc = '';
        this.sourceRefresh().then(() => {
          requests.request(this.url).then(({ data }) => {
            this.error = null;
            if (!data)
              this.markdown = 'Здесь пусто :(';
            else if (this.isTemplate) {
              this.markdown = mustache.render(data, this.source.dataset);
            } else
              this.markdown = data;
          }).catch((e) => {
            this.error = e;
          });
        });
      }
    }
  };
</script>

<style>

.theme--light.v-application code {
  background: none !important;
}

.dochub-object {
  margin-top: 24px;
  margin-bottom: 24px;
}
.space {
  padding: 24px;
  position: relative;
  /* min-height: 100vh; */
  min-height: 60px;
}

.toc {
  margin-bottom: 24px;
}

.markdown-document {
    font-size: 1rem;
    line-height: 1.5rem;
}

.markdown-document pre {
  display: block;
  padding: 9.5px;
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.42857143;
  color: #333;
  word-break: break-all;
  word-wrap: break-word;
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: auto;
}

.markdown-document code[class*="language-"]:first-child {
  margin-left: -12px;
}

.markdown-document code[class*="language-"],
.markdown-document pre[class*="language-"] {
  padding: 16px 13px;
  color: black;
  font-weight: 300;
  background: none;
  text-shadow: 0 1px white;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.5;
  -moz-tab-size: 4;
  -o-tab-size: 4;
  tab-size: 4;
  -webkit-hyphens: none;
  -moz-hyphens: none;
  -ms-hyphens: none;
  hyphens: none;
  font-size: 13px;
  border-radius: 0;
}
.toc-anchor {
  display: none;
}
.markdown-document code[class*="language-"]::before, pre[class*="language-"]::before,
.markdown-document code[class*="language-"]::after, pre[class*="language-"]::after
{
  content: none !important;
}
.markdown-document table {
  border: solid #ccc 1px;
}
.markdown-document table.table td {
  padding-left: 6px;
  padding-right: 6px;
}
.markdown-document table thead th * {
  color: #fff !important;
}
.markdown-document table thead th  {
  background: rgb(52, 149, 219);
  color: #fff !important;
  height: 40px;
}
.markdown-document table.table thead th {
  padding: 6px;
}
.markdown-document h1 {
  font-size: 1.5rem;
  margin-bottom: 18px;
  margin-bottom: 24px;
  clear:both;
}

.markdown-document h2 {
  margin-bottom: 18px;
  font-size: 1.25rem;
  clear:both;
}

.markdown-document h1:not(:first-child),
.markdown-document h2:not(:first-child) {
  margin-top: 56px;
}

.markdown-document h3,
.markdown-document h4,
.markdown-document h5 {
  margin-bottom: 18px;
  font-size: 1.125rem;
  clear:both;
}

.markdown-document h3:not(:first-child),
.markdown-document h4:not(:first-child),
.markdown-document h5:not(:first-child) {
  margin-top: 32px;
}

.markdown-document ul,
.markdown-document ol
{
  margin-bottom: 18px;
}

.markdown-document code[class*="language-"]{
  font-family: Menlo,Monaco,Consolas,Courier New,Courier,monospace;
  line-height: 22.4px;
  /* margin: 16px 13px; */
  font-size: 14px;
  border-radius: 8px;
}

.markdown-document code[class*="language-"] .token{
  background: none;
}

.markdown-document pre[class*="language-"]{
  border-radius: 4px;
  border: none;
  background-color: #eee;
}

.markdown-document pre[class*="language-mustache"] .token.variable{
  color: #cd880c;
}

</style>
