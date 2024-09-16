<template>
  <div>
    <dochub-doc 
      ref="desk"
      v-model="state"
      :path="currentPath"
      :params="params"
      :editor="true"
      @on-document-mounted="onMountedDocument" />
  </div>
</template>

<script>

  import { EditorEvents } from 'dochub-sdk';

  export default {
    name: 'EditorDesk',
    data() {
      return {
        state: {},
        currentPath: this.$router.currentRoute?.path.slice(7),
        params: this.$router.currentRoute?.query,
        command: null
      };
    },
    computed: {
      documentPath() {
        const targetURL = new URL(this.currentPath, window.location.href);
        Object.keys(this.params).map((key) => targetURL.searchParams.append(key, this.params[key].toString()));
        return `${targetURL.pathname}${targetURL.search}`;
      }
    },
    watch: {
      state(value) {
        this.$store.dispatch('updateEditor', {
          documentPath: this.documentPath,
          title: value.title
        });
      },
      '$route.path'(to) {
        this.currentPath = to.slice(7);
      },
      '$route.query'(params) {
        if (JSON.stringify(params) !== JSON.stringify(this.params)) {
          // Если параметры поменялись, мы не парсим хэш т.к. компонент будет пересоздан и ему он потребуется
          this.params = params;
        } else this.parseHashCommands(); // Если параметры не изменились, считаем, что изменился только hash
      }
    },
    methods: {
      onMountedDocument(document) {
        debugger;
        this.parseHashCommands(document);
      },
      parseHashCommands(document) {
        const event = this.$router.currentRoute?.hash.slice(1);
        // Определяем колбэки события
        let success = null;
        let reject = (error) => {
          throw new Error(error);
        };
        switch (event) {
          case EditorEvents.close:
            success ||= (result) => result && this.$store.dispatch('closeEditor', this.documentPath);
            break;
          case EditorEvents.save:
            success ||= () => true;
            break;
          case EditorEvents.create:
            success ||= () => true;
            break;
          case EditorEvents.delete: {
            success ||= () => true;
            break;
          }
        }
        // Отправляем событие в компонент редактора и ожидаем колбэки
        const target = document || this.$refs.desk.$refs.component; 
        if (success && target) {
          debugger;
          // После обработки события очищаем хэш
          window.location.hash = '';
          target.$emit(event, { success, reject });
        }
      }
    }
  };
</script>

<style scoped>
</style>
