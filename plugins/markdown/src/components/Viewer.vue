<template>
  <div class="space markdown-document">
    <div v-if="tocHTML" class="toc" v-html="tocHTML" />
    <markdown
      v-if="content && !isRefresh"
      toc
      :toc-first-level="0"
      :toc-last-level="100"
      :breaks="false"
      :html="isHTMLSupport"
      :postrender="renderToVue"
      @toc-rendered="tocRendered">
      {{ content }}
    </markdown>
    <presentation v-if="presentationCode" :template="presentationCode" />
  </div>
</template>

<script>
  import markdown from 'vue-markdown';
  import { DocHub } from 'dochub-sdk';
  import mustache from 'mustache';

  export default {
    name: 'MarkdownViewer',
    components: {
      markdown,
      // eslint-disable-next-line vue/no-unused-components
      presentation: {
        props: {
          template: { type: String, default: '' }
        },
        created() {
          this.$options.template = `<div class="markdown-document">${this.template}</div>`;
        }
      }      
    },
    props: {
      // Требуем обязательно передавать функцию получения контента
      getContent: {
        type: Function,
        required: true
      },
      // Требуем обязательно передавать профайл документа 
      profile: {
        type: Object,
        required: true
      },
      // Признак того, что документ встроен в другой документ
      inline: {
        type: Boolean,
        required: true
      },
      // Требуем обязательно передавать функцию запросов к DataLake
      pullData: {
        type: Function,
        required: true
      }
    },
    data() {
      return {
        tocShow: true,
        tocHTML: null,
        isRefresh: null,
        presentationCode: '',
        content: ''
      };

    },
    computed: {
      // Определяет поддерживаются ли HTML тэги в markdown
      isHTMLSupport() {
        const settings = DocHub.settings.pull({
          MARKDOWN_HTML: (DocHub.env.MARKDOWN_HTML || 'off').toLocaleLowerCase() === 'on'
        });
        return settings?.MARKDOWN_HTML;
      },
      tocSensitivity() {
        const settings = DocHub.settings.pull({
          MARKDOWN_TOC_SENS: 3
        });
        return settings?.MARKDOWN_TOC_SENS;
      }
    },
    watch: {
      profile() {
        this.onRefresh();
      },
      content() {
        this.isRefresh && clearTimeout(this.isRefresh);
        this.isRefresh = setTimeout(() => this.isRefresh = null, 50);
      }
    },
    mounted() {
      // При монтировании компонента в DOM, генерируем событие обновления
      this.onRefresh();
    },
    methods: {
      rerenderPresentation() {
        return new Promise((success) => {
          this.showPresentation = false;
          this.$nextTick(() => this.showPresentation = true && success(true));
        });
      },
      renderToVue(html) {
        // Парсим ссылки на объекты DocHub
        const result = html.replace(/<img /g, '<dochub-object :inline="true" ')
          .replace(/\{\{/g, '<span v-pre>{{</span>')
          .replace(/\}\}/g, '<span v-pre>}}</span>');
        if (this.presentHTML != result) {
          this.presentationCode = result;
          this.rerenderPresentation().then(() => {
            // eslint-disable-next-line no-undef
            Prism.highlightAll();
          });
        }
        return '';
      },
      tocRendered(tocHTML) {
        // Не выводим оглавление, если в нем всего три раздела или меньше
        // eslint-disable-next-line no-useless-escape
        this.tocHTML = !this.inline && ((tocHTML.match(/\<li\>.*\<\/li\>/g) || []).length > this.tocSensitivity) && tocHTML;
      },
      // Функция обновления контента документа с учетом параметров содержащихся в "this.profile"
      doRefresh() {
        if (this.profile) {
          this.getContent(this.profile.template || this.profile.source)
            .then((response) => {
              if (this.profile.template) {
                this.pullData().then((data) => {
                  this.content = mustache.render(response.data, data);
                }).catch((error) => {
                  this.content = `# Ошибка !\n\n Выполнение запроса для построения шаблона выполнено с ошибкой:\n\n${error.toString()}\n\nЗапрос: \`\`\`jsonata\n${this.profile.source}\n\`\`\`\n`;
                });
              } else {
                this.content = response.data;
                this.content ||= 'Здесь пусто :(';
              }
            })
            .catch((error) => {
              this.content = `# Ошибка!\n\n Запрос к ресурсу [${this.profile.source}] был выполнен с ошибкой!\n\n ${error.toString()}`;
            });
        } else {
          this.content = '';
        }
      },

      // Обработчик события обновления
      onRefresh() {
        // Если обработчик уже запущен, останавливаем его
        if (this.refresher) clearTimeout(this.refresher);
        // Для исключения избыточных обращений к Data Lake откладываем обновление на 50мс
        this.refresher = setTimeout(this.doRefresh, 50);
      }      
    }
  };
</script>

<style scoped>

.table-of-contents {
  list-style-type: none;
  padding-left: 0;
}

.theme--light.v-application code {
  background: none !important;
}

.dochub-object {
  margin-top: 12px 24px;
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
