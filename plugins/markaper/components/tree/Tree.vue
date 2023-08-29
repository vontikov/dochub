<template>
  <div class="mkr-tree">
    <tree-item 
      v-bind:expands="expands"
      v-bind:items="tree" />
  </div>
</template>

<script>

  import schema from '../../schema/tree';
  import TreeItem from './TreeItem';

  import ajv from 'ajv';
  const ajv_localize = require('ajv-i18n/localize/ru');

  export default {
    name: 'MKRTree',
    components: {
      TreeItem
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
        // Массив меню
        tree: [],
        // Открытые элементы
        expands: {},
        // Обработчик события обновления
        refresher: null,
        // Модель документа
        model: [],
        // Информация об ошибке
        error: null
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
      // Строит дерево
      makeTreeItems(items) {
        let counter = 0;
        const result = [];
        const expandItem = (expitem) => {
          let node = result;
          expitem.location.split('/').map((title, index, arr) => {
            let item = node.find((element) => element.title === title);
            if (!item) {
              node.push(
                item = {
                  title: title,
                  key: `${title}_${counter++}`,
                  items: []
                }
              );
            }
            if (arr.length - 1 === index) {
              item.link = expitem.link;
            }
            node = item.items;
          });
        };
        items.map((item) => expandItem(item));
        return result;
      },
      // Обновляем данные модели разметки
      doRefresh() {
        this.pullData().then((items) =>{
          try {
            // Валидируем данные по структуре
            const rules = new ajv({ allErrors: true });
            const validator = rules.compile(schema);
            if (!validator(items)) {
              ajv_localize(validator.errors);
              this.error = JSON.stringify(validator.errors, null, 4);
              return;
            } 
            // Если все в порядке, обновляем модель
            this.error = null;
            this.expands = {};
            this.tree = this.makeTreeItems(items);
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
  .mkr-tree {
    overflow-y: hidden;
    overflow-x: auto;
  }
</style>
