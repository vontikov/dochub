<template>
  <div class="markdown-editor">
    <div v-if="isCreated">CREATED!</div>
    <v-row>
      <v-progress-linear v-if="isSaving" indeterminate />
    </v-row>
    <v-row>
      <coder :code="code" :api="coderAPI" @onchange="onChangeCode" />
    </v-row>
    <v-snackbar v-model="saveSuccess" timeout="1000">
      Сохранено!
      <template #action="{ attrs }">
        <v-btn color="blue" text v-bind="attrs" @click="saveSuccess = false">
          Закрыть
        </v-btn>
      </template>
    </v-snackbar>    
  </div>
</template>

<script>
  import coder from './Coder.vue';
  import { EditorEvents } from 'dochub-sdk';

  // Проверка орфографии

  export default {
    name: 'MarkdownEditor',
    components: {
      coder
    },
    props: {
      profile: {
        type: Object,
        required: true
      },
      // Требуем обязательно передавать функцию получения контента
      getContent: {
        type: Function,
        required: true
      },
      // Требуем обязательно передавать функцию записи контента
      putContent: {
        type: Function,
        required: true
      }
    },
    data() {
      return {
        isCreated: false,
        coderAPI: {
          getCode: () => ''
        },
        isChanged: false,
        saveSuccess: false,
        isSaving: false,
        code: ''
      };
    },
    computed: {
      profileURI() {
        return this.profile?.__uri__;
      },
      title() {
        return this.profile?.title 
          || this.profile?.location?.split('/').pop()
          || (this.profile?.template || this.profile?.source)
          || '???';
      },
      contentURI() {
        return this.profile?.template || this.profile?.source;
      }
    },
    mounted() {
      document.addEventListener('keydown', this.onHotKeys);
      this.onRefresh();
      this.$on(EditorEvents.close, (listener) => {
        listener.success(true);
      });
      this.$on(EditorEvents.create, (event) => {
        this.isCreated = event;
      });
    },
    beforeDestroy() {
      document.removeEventListener('keydown', this.onHotKeys, false);
    },
    methods: {
      onHotKeys(event) {
        if (event.ctrlKey && event.code==='KeyS')  {
          this.doSave();
          event.preventDefault();  
        }
        return false;
      },
      updateState() {
        this.$emit('input', {
          title: this.title
        });
      },
      onChangeCode(state) {
        this.isChanged = state;
      },
      // Выполняет загрузку кода
      doRefresh() {
        if (this.profile) {
          this.getContent(this.contentURI)
            .then((response) => this.code = response.data)
            .catch((error) => {
              this.code = `# Ошибка!\n\n Запрос к ресурсу [${this.contentURI}] был выполнен с ошибкой!\n\n ${error.toString()}`;
            });
        } else {
          this.code = '';
        }
      },
      // Обработчик события обновления
      onRefresh() {
        this.updateState();
        // Если обработчик уже запущен, останавливаем его
        if (this.refresher) clearTimeout(this.refresher);
        // Для исключения избыточных обращений к Data Lake откладываем обновление на 50мс
        this.refresher = setTimeout(this.doRefresh, 50);
      },      
      // Выполняет сохранение кода
      doSave() {
        this.isSaving = true;
        debugger;
        this.putContent(this.contentURI, this.coderAPI.getCode()) 
          .then(() => {
            this.saveSuccess = true;
            this.isChanged = false;
            this.isSaving = false;
          })
          .catch(() => this.isSaving = false);
      }
    }
  };
</script>

<style scoped>

.markdown-editor {
  width: 100%;
  min-height: 400px;
  padding-top: 14px;
  padding-left: 12px;
  padding-right: 12px;  
}

</style>
