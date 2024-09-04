<template>
  <div class="integration-setting-profile-list">
    <div style="min-height: 64px">
      <img class="integration-setting-logo" :src="logo">
      Интеграция с {{ name }} позволяет использовать его как хранилище архкода со встроенным управлением 
      версиями, разграничением доступа и возможностью аудита. Вносимые изменения в репозиторий будут сразу
      отображаться в DocHub.
    </div>
    <h3 class="integration-setting-header">Настройки</h3>
    <slot name="config" />
    <template v-if="driver?.isActive">
      <h3 class="integration-setting-header">Статус авторизации</h3>
      <div class="integration-setting-status">
        <template v-if="thisStatus?.isLogined">
          <v-avatar color="indigo">
            <img v-if="thisStatus?.avatarURL" :src="thisStatus?.avatarURL">
            <v-icon v-else dark>
              mdi-account-circle
            </v-icon>
          </v-avatar>
          <strong> {{ thisStatus?.userName || 'Что-то с авторизацией не так...' }}</strong>
          <br><br>
        </template>
        <slot 
          name="actions"
          :processing="isProcessing"
          :logined="thisStatus?.isLogined"
          :login="login"
          :logout="logout" />
      </div>
    </template>
  </div>
</template>

<script>
  import statusMixin from '../mixins/status';
  import settingsMixin from '../mixins/settings';

  export default {
    name: 'IntegrationSettings',
    mixins: [statusMixin, settingsMixin],
    props: {
      driver: {
        type: Object,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      logo: {
        type: String,
        required: true
      }
    },
    data() {
      return {
        isProcessing: false
      };
    },
    computed: {
      thisStatus() {
        return this.status[(this.driver?.getAlias || (()=>null))() || ''];
      }
    },
    methods: {
      login() {
        this.isProcessing = true;
        DocHub.eventBus.$emit(this.driver.Events.login);
      },
      logout() {
        this.isProcessing = true;
        DocHub.eventBus.$emit(this.driver.Events.logout);
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      refresh() {
        this.isProcessing = false;
      }
    }
  };
</script>

<style>
.integration-setting-profile-list {
  width: 100%;
  padding: 8px;
}

.integration-setting-status {
  margin-left: 8px;
}

.integration-setting-logo {
  float: left;
  margin-right: 16px;
  margin-bottom: 16px;
}

.integration-setting-header {
  margin-top: 24px;
  margin-bottom: 8px;
  display: block;
}
</style>


