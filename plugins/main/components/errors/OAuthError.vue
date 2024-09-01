<template>
  <v-row align="center" style="justify-content: center;">
    <v-alert class="alert" outlined type="error" prominent border="left" elevation="2">
      <h3 class="text-h5">
        Ошибка при авторизации {{ driver }}!
      </h3>
      Проверьте 
      <a :href="`https://github.com/RabotaRu/dochub?tab=readme-ov-file#%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F-%D1%81-${driver}`" target="_blank">настройки</a>
      DocHub по интеграции с {{ driver }} и корректность своих прав на работу с репозиторием.
      <v-divider
        class="my-4 info"
        style="opacity: 0.22" />
      <v-btn color="info" outlined @click="doRetry">
        Попробовать снова!
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
    computed: {
      driver() {
        return this.$route.params.driver;
      }
    },
    methods: {
      doRetry() {
        window.DocHub.eventBus.$emit(`${this.driver}-login-retry`);
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
