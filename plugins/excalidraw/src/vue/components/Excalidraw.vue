<template>
  <div class="excalidraw-document">
    <react 
      :component="excalidraw"
      :passed-props="passedProps"
      :message="message"
      class="excalidraw-desk" />
    <v-snackbar v-model="saveSuccess" timeout="1000">
      Сохранено!
      <template #action="{ attrs }">
        <v-btn color="blue" text v-bind="attrs" @click="saveSuccess = false">
          Закрыть
        </v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="error" timeout="1000">
      ОШИБКА: {{ error }}
      <template #action="{ attrs }">
        <v-btn color="red" text v-bind="attrs" @click="error = ''">
          Закрыть
        </v-btn>
      </template>
    </v-snackbar>
    <template v-if="isLoading">
      <div class="fog" />
      <v-progress-circular class="progress" :size="50" color="primary" indeterminate />
    </template>
  </div>
</template>

<script>
  import { ReactWrapper } from 'vuera';
  import { Excalidraw } from '@excalidraw/excalidraw';  
  // import { Excalidraw } from '@excalidraw/excalidraw@preview';  
  import { Button } from './button.tsx';
  import { serializeAsJSON } from '@excalidraw/excalidraw';

  // Документация на подключение Excalidraw здесь - https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation
  window.EXCALIDRAW_ASSET_PATH = '/';

  export default {
    name: 'ExcalidrawDocument',
    components: {
      react: ReactWrapper
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
      }
    },
    data() {
      return {
        error: '',
        isLoading: true,
        saveSuccess: null,
        saveReject: null,
        excalidraw: Excalidraw,
        excalidrawAPI: null,
        passedProps: {
          renderTopRightUI: () => Button(this.doSave),
          /*
          UIOptions: {
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              loadScene: true,
              saveToActiveFile: true
            }
          },
          */
          excalidrawAPI: (api) => {
            this.excalidrawAPI = api;
            this.doRefresh();
          },
          initialData: {
            elements: [],
            appState: { zenModeEnabled: false },
            scrollToContent: true
          }
        },
        message: 'Hello from React!',
        // Обработчик события обновления
        refresher: null
      };
    },
    computed: {
    },
    watch: {
      profile() {
        // При изменении параметров, генерируем событие обновления
        this.onRefresh();
      }
    },
    methods: {
      doSave() {
        this.isLoading = true;
        const content = serializeAsJSON(
          this.excalidrawAPI.getSceneElements(),
          this.excalidrawAPI.getAppState()
        );
        this.putContent(this.profile.source, content)
          .then(() => this.saveSuccess = true)
          .catch((error) => this.saveReject = error.toString())
          .finally(() => this.isLoading = false);
      },
      // Функция обновления контента документа с учетом параметров содержащихся в "this.profile"
      doRefresh() {
        if (this.profile) {
          this.isLoading = true;
          this.getContent(this.profile.source)
            .then((response) => {
              try {
                const scene = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                this.excalidrawAPI.updateScene(scene || {});
                this.$nextTick(() => {
                  debugger;
                  this.$el.dispatchEvent(new KeyboardEvent('keydown', { 'key': '1', shiftKey: true }));
                  this.$el.dispatchEvent(new KeyboardEvent('keydown', { 'key': '!', shiftKey: true }));
                  this.$el.querySelector('div.excalidraw-desk').dispatchEvent(new KeyboardEvent('keydown', { 'key': '1', shiftKey: true }));
                  this.$el.querySelector('div.excalidraw-desk').dispatchEvent(new KeyboardEvent('keydown', { 'key': '!', shiftKey: true }));
                });
              } catch (error) {
                // eslint-disable-next-line no-console
                console.info(error);
                this.error = error.toString();
              }
            })
            .catch((error) => {
              // eslint-disable-next-line no-console
              console.info(error);
              this.error = error.toString();
            })
            .finally(() => this.isLoading = false);
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

<style>

.layer-ui__wrapper__top-right label {
  display: none;
}

</style>

<style scoped>

.excalidraw-document {
  height: 100%;
} 

.excalidraw-document .excalidraw-desk {
  height: 100%;
} 

.excalidraw-document .fog {
  z-index: 10000;
  background: #000;
  opacity: 0.3;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0px; 
  left: 0px;
}

.excalidraw-document .progress {
  z-index: 10000;
  position: absolute;
  left: 50%;
  top: 50%;
}

</style>

