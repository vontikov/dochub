<template>
  <div 
    style="width: 400px; height: 300px; left: 50%; top: 50%; position: absolute; margin-left: -150px; margin-top: -150px; text-align:center;">
    Корневой манифест архитектуры <strong>dochub.yaml</strong> не обнаружен или не может быть загружен.<br><br>
    Если файл существует, пожалуйста, проверьте его содержимое на наличие ошибок. Если манифест отсутствует, воспользуйтесь помощником для его создания.
    <br><br>
    <v-btn depressed color="primary" v-on:click="initEmptyProject">Создать пустой файл</v-btn>
    <br><br>
    <v-btn depressed color="primary" v-on:click="initExampleProject">Создать пример</v-btn>
  </div>
</template>

<script>

  export default {
    name: 'Empty',
    data() {
      return {};
    },
    methods: {
      initEmptyProject() {
        window.$PAPI.initProject();
      },
      initExampleProject() {
        window.$PAPI.initProject('example');
      }
    }
  };
</script>

<style scoped>


</style>
