<template>
  <div class="bpmnjs">
    <modeler
      v-if="isEdit"
      v-model="content"
      v-bind:profile="profile"
      v-bind:get-content="getContent"
      v-bind:put-content="putContent" 
      v-on:onEdit="onEdit" />
    <viewer 
      v-else
      v-model="content"
      v-bind:profile="profile"
      v-bind:get-content="getContent"
      v-bind:put-content="putContent" 
      v-on:onEdit="onEdit" />
  </div>
</template>

<script>
  import modeler from './Modeler.vue';
  import viewer from './Viewer.vue';
  import emptyDiagram from '!!raw-loader!../../resource/empty.bpmn';

  export default {
    components: {
      modeler,
      viewer
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
      // Требуем обязательно передавать функцию сохранения контента
      putContent: {
        type: Function,
        required: true
      }
    },
    data() {
      return {
        isEdit: false,
        content: emptyDiagram,
        error: null,
        source: null
      };
    },
    watch: {
      profile(value) {
        (value.source !== this.source) && this.reload();
      }
    },
    mounted() {
      this.reload();
    },
    methods: {
      onEdit(mode) {
        this.isEdit = mode;
      },
      // Загрузка контента
      async reload() {
        this.getContent(this.profile.source)
          .then((response) => {
            this.source = this.profile.source;
            this.content = response.data || emptyDiagram;
          })
          .catch((error) => {
            this.content = emptyDiagram;
            this.error = `Ошибка загрузки файла [${this.profile.source}]: <br> ${error}</div>`;
          });
      }
    }
  };
</script>

<style scoped>

.bpmnjs {
  min-height: 400px;
}

</style>
