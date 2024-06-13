<template>
  <div class="space">
    <h1>Пример простого плагина</h1>
    <h2>Параметры передаваемые в плагин:</h2>
    <table>
      <tr>
        <td class="label">Путь к объекту документа (this.path):</td>
        <td>{{ path }}</td>
      </tr>
      <tr>
        <td>Профиль документа (this.profile):</td>
        <td>{{ profile }}</td>
      </tr>
      <tr>
        <td>Переданные параметры (this.params):</td>
        <td>{{ params }}</td>
      </tr>
      <tr>
        <td>Версия для печати (this.toPrint):</td>
        <td>{{ toPrint }}</td>
      </tr>
    </table>
    <h2>Пример результата запроса к данным архитектуры из плагина</h2>
    В кодовой базе:
    <table>
      <tr>
        <td class="label">Документов</td>
        <td>{{ dataFromLake.docs }}шт</td>
      </tr>
      <tr>
        <td>Компонентов:</td>
        <td>{{ dataFromLake.components }}шт</td>
      </tr>
      <tr>
        <td>Контекстов:</td>
        <td>{{ dataFromLake.contexts }}шт</td>
      </tr>
    </table>
    <h2>Пример получения данных из DataSet в плагине</h2>
    Обнаружены компоненты уровня L1 по C4 Model:
    <table>
      <tr>
        <th style="width:20%">ID</th>
        <th style="width:40%">Наименование</th>
      </tr>
      <tr v-for="component in componentsL1" v-bind:key="component.id">
        <td><a v-bind:href="component.link">{{ component.id }}</a></td>
        <td><a v-bind:href="component.link">{{ component.location }}</a></td>
      </tr>
    </table>
    <h2>Результат рендеринга файла с HTML кодом:</h2>
    <div class="html-example" v-html="content" />
    <h2>Встроенный документ DocHub</h2>
    <dochub-object src="@document/dochub.example.swgr" />
  </div>
</template>

<script>

  export default {
    name: 'HTMLDocument',
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
        // Здесь будет храниться контент из полученного HTML файла 
        content: '',
        // Здесь будет храниться результат запроса к данным архитектуры
        dataFromLake: {},
        // Здесь будет храниться результат выполнения запроса к DataSet
        componentsL1: []
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
          // В архитектурной кодовой базе указываются относительные пути к файлам при описании документа.
          // Для успешного получения контента этих файлов необходимо использовать функцию getContent.
          // Рекумендуется также использовать эту функцию для доступа к любым иным ресурсам по http/https.
          this.getContent(this.profile.source)
            // Если все хорошо, рендерим HTML "как есть"
            .then((response) => {
              this.content = response.data;
            })
            // Если что-то пошло не так, генерируем HTML с ошибкой
            .catch((error) => {
              this.content = `<div style="color:#fff; background-color: #f00">Ошибка выполнения запроса [${this.profile.source}]: <br> ${error}</div>`;
            });
        } else this.content = '';

        // Выполняем запрос к данным архитектуры
        this.pullData(`
          ({
            "docs": $count(docs.*),
            "components": $count(components.*),
            "contexts": $count(contexts.*)
          })
        `).then((result) => this.dataFromLake = result);

        // Выполняем запрос к DataSet
        this.pullData('dochub.plugins.example')
          .then((result) => this.componentsL1 = result);

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

.html-example {
  padding: 12px;
  margin: 12px;
  border: solid 1px #ccc;
}

</style>
