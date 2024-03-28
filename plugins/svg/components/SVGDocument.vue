<template>
  <div class="svg-image" v-html="content" />
</template>

<script>
  import mustache from 'mustache';

  export default {
    name: 'SVGDocument',
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
      // Требуем обязательно передавать функцию доступа к Data Lake
      pullData: {
        type: Function,
        required: true
      },
      // Требуем обязательно сообщать путь к объекту описывающему документ в коде
      path: {
        type: String,
        required: true
      },
      // Запрашиваем параметры рендеринга
      params: {
        type: Object,
        default: null
      },
      // Признак рендеринга для печати
      toPrint: {
        type: Boolean,
        default: false
      }
    },
    data() {
      return {
        // Обработчик события обновления
        refresher: null,
        // Здесь будет храниться контент из полученного SVG файла 
        content: '',
        data: null
      };
    },

    watch: {
      profile() {        
        // При изменении переметров, генерируем событие обновления
        this.onRefresh();
      }
    },
    mounted() {
      // При монтировании компонента в DOM, генерируем событие обновления
      this.onRefresh();
    },
    methods: {
      // Функция обновления контента документа с учетом параметров содержащихся в "this.profile"
      doRefresh() {
        if (this.profile) {
          this.pullData(this.profile.source)
            .then( (data) => {
              this.data = data;
            })
            .then( () => this.getContent(this.profile.template) )
            // Если все хорошо, рендерим HTML "как есть"
            .then((response) => {
              this.content = mustache.render(response.data, this.data);
            })
            // Если что-то пошло не так, генерируем HTML с ошибкой
            .catch((error) => {
              this.content = `<div style="color:#fff; background-color: #f00">Ошибка выполнения запроса: <br> ${error}</div>`;
            });
        } else {
          this.data = null;
          this.content = '';
        }
      },

      // Обработчик события обновления
      onRefresh() {
        // Если обработчик уже запущен, останавливаем его
        if (this.refresher) clearTimeout(this.refresher);
        // Для исключения избыточных обращений к Data Lake откладывам обноление на 50мс
        this.refresher = setTimeout(this.doRefresh, 50);
      }
    }
  };
</script>

<style scoped>
h2 {
  margin-top: 24px;
}

td {
  padding: 6px;
  ;
}

.space {
  padding: 12px;
}

.label {
  width: 20%;
}

.svg-image {
  padding: 12px;
  margin: 12px;
  border: solid 1px #ccc;
}</style>
