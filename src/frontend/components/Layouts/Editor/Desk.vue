<template>
  <div>
    <dochub-doc 
      ref="desk"
      v-model="state"
      :path="currentPath"
      :params="params"
      :editor="true" />
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
        debugger;
        this.currentPath = to.slice(7);
        this.parseHashCommands();
      },
      '$route.query'(params) {
        this.params = params;
        this.parseHashCommands();
      },
      '$route.hash'() {
        this.parseHashCommands();
      }
    },
    mounted() {
      this.parseHashCommands();
    },
    methods: {
      parseHashCommands() {
        const event = this.$router.currentRoute?.hash.slice(1);
        switch (event) {
          case EditorEvents.close: 
          case EditorEvents.save:
          case EditorEvents.create:
          case EditorEvents.delete: {
            // Отправляем событие в компонент редактора и ожидаем колбэки
            if (this.$refs.desk.$refs.component) {
              /*
              const watcher = setTimeout(() => {
                this.$store.dispatch('closeEditor', this.documentPath);
              }, 2000);
              */
              this.$refs.desk.$refs.component.$emit(event, {
                success: (result) => {
                  result && this.$store.dispatch('closeEditor', this.documentPath);
                  // clearTimeout(watcher);
                },
                reject: (error) => {
                  throw new Error(error);
                }
              });
            } else {
              this.$store.dispatch('closeEditor', this.documentPath);
            }
            break;
          }
        }
      }
    }
  };
</script>

<style scoped>
</style>
