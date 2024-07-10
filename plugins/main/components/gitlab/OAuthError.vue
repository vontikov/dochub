<template>
  <v-row align="center" style="justify-content: center;">
    <v-alert class="alert" outlined type="error" prominent border="left" elevation="2">
      <h3 class="text-h5">
        Ошибка при авторизации GitLab!
      </h3>
      Проверьте 
        <a href="https://github.com/RabotaRu/dochub?tab=readme-ov-file#%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F-%D1%81-gitlab" target="_blank">настройки</a>
      DocHub по интеграции с GitLab и корректность своих прав на работу с репозиторием.
      <v-divider
        class="my-4 info"
        style="opacity: 0.22"></v-divider>
        <v-btn color="info" outlined v-on:click="doRetry">
            Не отчаиваться!
        </v-btn>
    </v-alert>
  </v-row>
</template>

<script>

  export default {
    name: 'OAuthError',
    data() {
      return {
      };
    },
    methods: {
      doRetry() {
        window.DocHub.eventBus.$emit('gitlab-login-retry');
      }
    }
  };
</script>

<style scoped>
.alert {
  height:auto;
  width: 600px;
  max-width: 500px;
}
</style>
