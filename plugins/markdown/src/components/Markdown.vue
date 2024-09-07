<template>
  <div class="markdown-document">
    <viewer v-if="mode === 'view'" :content="content" :inline="inline" />
    <editor v-else-if="mode === 'edit'" :code="code" :profile="profile" @save="onSave" @exit="onEditExit" />
    <div v-else>Ошибка плагина! Неподдерживаемый тип представления {{ mode }}</div>
    <v-toolbar v-if="putContent && mode === 'view'" dense floating elevation="0" color="rgba(0, 0, 0, 0.03)" class="toolbar">
      <v-btn icon title="Редактировать" v-on:click="onEdit">
        <v-icon>mdi-file-edit-outline</v-icon>
      </v-btn>
    </v-toolbar>
  </div>
</template>

<script>
  import mustache from 'mustache';

  import Viewer from './Viewer.vue';
  import Editor from './Editor.vue';

  const Mode  = {
    view: 'view',
    edit: 'edit'
  };

  export default {
    name: 'MarkdownDocument',
    components: {
      Viewer,
      Editor
    },
    props: {
      // Требуем обязательно передавать профайл документа 
      profile: {
        type: Object,
        required: true
      },
      // Требуем обязательно передавать функцию получения контента
      getContent: {
        type: Function,
        required: true
      },
      // Получаем функцию сохранения контента если есть
      putContent: {
        type: Function,
        default: null,
        required: false
      },
      // Признак того, что документ встроен в другой документ
      inline: {
        type: Boolean,
        default: false
      },
      // Получаем функцию сохранения контента если есть
      pullData: {
        type: Function,
        default: null,
        required: true
      }
    },
    data() {
      return {
        mode: Mode.view,
        // Обработчик события обновления
        refresher: null,
        // Содержимое файла
        content: '',
        // Контент для редактирования
        code: ''
      };
    },
    computed: {
      codeSubject() {
        return this.profile.template || this.profile.source;
      }
    },
    watch: {
      profile() {
        // При изменении параметров, генерируем событие обновления
        this.onRefresh();
      }
    },
    mounted() {
      // При монтировании компонента в DOM, генерируем событие обновления
      this.onRefresh();
      // this.onEdit();
    },
    methods: {
      onEditExit() {
        this.mode = Mode.view;
        this.doRefresh();
      },
      onSave(change) {
        this.putContent(this.codeSubject, change.code)
          .then(change.success)
          .catch(change.reject);
      },
      // Открываем редактор
      onEdit() {
        if (this.profile?.template) {
          this.getContent(this.profile.template)
            .then((response) => {
              this.code = response.data;
              this.mode = Mode.edit;
            })
            .catch((error) => {
              this.mode = Mode.view;
              this.content = `!!!! Не могу открыть на редактирование шаблон [${this.profile.template}]\n\n ${error.toString()}`;
              setTimeout(() => this.doRefresh, 3000);
            });
        } else {
          this.code = this.content;
          this.mode = Mode.edit;
        }
      },
      // Функция обновления контента документа с учетом параметров содержащихся в "this.profile"
      doRefresh() {
        if (this.profile) {
          this.getContent(this.profile.template || this.profile.source)
            .then((response) => {
              if (this.mode === Mode.view) {
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
              } else 
                this.code = response.data;
            })
            .catch((error) => {
              this.content = `# Ошибка!\n\n Запрос к ресурсу [${this.profile.source}] был выполнен с ошибкой!\n\n ${error.toString()}`;
            });
        } else this.content = '';
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

.markdown-document:hover .toolbar {
  display: block;
} 

.markdown-document .toolbar {
  display: none;
  position: absolute;
  right: 20px;
  top: 20px;
  background-color: 0 !important;
  color: 0 !important;
  border: 1px solid rgba(0, 0, 0, 0.2) !important;
}


</style>
