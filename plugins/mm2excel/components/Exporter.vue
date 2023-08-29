<template>
  <div>
    <h1>Экпорт метамодели в Excel шаблон</h1>
    <v-alert v-if="error" type="error" v-bind:value="true" style="white-space: pre-wrap;">
      {{ error }}
    </v-alert>
    <template v-if="!error && config">
      <ul>
        <li v-for="entity in entities" v-bind:key="entity">{{ entity }}</li>
      </ul>
      <button v-on:click="doExport">Погнали!</button>
      <v-alert v-if="exportError" type="error" v-bind:value="true" style="white-space: pre-wrap;">
        {{ exportError }}
      </v-alert>
    </template>
  </div>
</template>

<script>
  import driver from '../drivers/export';
  import schema from '../schema/export';
  import ajv from 'ajv';
  const ajv_localize = require('ajv-i18n/localize/ru');

  export default {
    name: 'MM2ExcelExporter',
    props: {
      // Требуем обязательно передавать функцию доступа к Data Lake
      pullData: {
        type: Function,
        required: true
      }
    },
    data() {
      return {
        // Обработчик события обновления
        refresher: null,
        // Конфигурация выгрузки документа
        config: {},
        // Информация об ошибке
        error: null,
        // Информация о возникшей ошибки при экспорте
        exportError: null
      };
    },
    computed: {
      entities() {
        return Object.keys(this.config || {});
      }
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
      // Выгружаем в Excel
      doExport() {
        driver({
          pullData: this.pullData,
          entities: this.entities
        }).catch((e) => this.exportError = e);
      },
      // Обновляем данные модели разметки
      doRefresh() {
        this.pullData().then((result) =>{
          try {
            // Валидируем данные по структуре
            const rules = new ajv({ allErrors: true });
            const validator = rules.compile(schema);
            if (!validator(result)) {
              ajv_localize(validator.errors);
              this.error = JSON.stringify(validator.errors, null, 4);
              return;
            } 
            // Если все в порядке, обновляем модель
            this.config = result;
            this.error = null;
          } catch (e) {
            this.error = e;
          }
        }).catch((e) => this.error = e);
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

</style>
